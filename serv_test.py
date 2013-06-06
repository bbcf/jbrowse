import os
import bottle
from bottle import mako_view
from bottle import view
from bottle import request
import sys
import getopt

app = bottle.Bottle()
import urllib


from wsgiproxy.app import WSGIProxyApp

port = 8080
prefix = ''
use_root = False

opts, args = getopt.getopt(sys.argv[1:], 'f:p:')

for opt in opts:
    if 'p' in opt[0]:
        port = opt[1]
    if 'f' in opt[0]:
        prefix = opt[1]
        print('[x] Serving on  prefix: %s' % prefix)
        root_app = bottle.Bottle()
        app.mount(prefix, root_app)
        use_root = False

# load static files
from bottle import SimpleTemplate
SimpleTemplate.defaults["_u"] = app.get_url
from bottle import static_file
SimpleTemplate.defaults["serv"] = 'http://sugar.epfl.ch/jbrowse-sg'

@app.route('/static/<filename:path>', name='static')
def server_static(filename):
    return static_file(filename, root='static/')


@app.post('/bam_viewer')
def bv():
    gviz_url = "http://bbcf-serv01.epfl.ch/gviz_sophia/gviews"
    parameters = {
        "gview[assembly_name]":  request.forms.get('assembly'),
        "gview[chr]": request.forms.get('chromosome'),
        "gview[pos]": request.forms.get('position'),
        "gview[window_size]": request.forms.get('window_size'),
        "gview[zoom]": request.forms.get('zoom'),
        #"gview[fname]": request.forms.get('fname')
    }
    data = urllib.urlopen(gviz_url, urllib.urlencode(parameters))
    return data.read()


@app.route('/bamview/<fname>/<species>/<chrnumber>/<position:int>')
@view('bamview.html')
def bamview(fname, species, chrnumber, position):
    import bamview
    window_size = int('w' in request.query and request.query['w'] or 1000)
    zoom = int('z' in request.query and request.query['z'] or 2)
    bam_file = os.path.join('test-data', fname) + '.bam'
    if not os.path.exists(bam_file):
        return "File '%s' does not exist." % bam_file
    result_js = bamview.generate_json(chrnumber, position, bam_file, species, window_size/2, zoom)
    return {'result_js': result_js}


@app.route('/<filename:path>')
def index(filename):
    path, fname = os.path.split(filename)
    if not fname:
        fname = 'index.html'
    print 'filename %s - %s ' % (filename, path)
    return static_file(fname, root=os.path.join(path, ''))


@app.route('/')
@view('index.html')
def home():
    return {}







"""
 def create
    #retrieve the parameters
 @gview = Gview.new(params[:gview])

 file = "lib/zhenyu.bam" ### for the moment static, must be another parameter like params[:gview][:filename]; path being known server side

  # run the command
 @cmd = "python /srv/gviz_sophia/lib/bam_viewer.py #{file} #{@gview.assembly_name} #{@gview.window_size} #{@gview.chr} #{@gview.pos} #{@gview.zoom}"
 @result_js = ""
 @error = ''
     Open4::popen4(@cmd) do |pid, stdin, stdout, stderr|
 @result_js = stdout.read.strip
 @error = stderr.read.strip
 end

   #render json
 respond_to do |format|
 format.html {render action: "show"}
 end
 end
 """

useapp = app
if use_root:
    useapp = root_app


bottle.debug(True)
bottle.run(useapp, host='localhost', port=port, reloader=True)
