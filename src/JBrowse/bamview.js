// This is a manifest file that'll be compiled into application.js, which will include all the files
// listed below.
//
// Any JavaScript/Coffee file within this directory, lib/assets/javascripts, vendor/assets/javascripts,
// or vendor/assets/javascripts of plugins, if any, can be referenced here using a relative path.
//
// It's not advisable to add code directly here, but if you do, it'll appear at the bottom of the
// the compiled file.
//
// WARNING: THE FIRST BLANK LINE MARKS THE END OF WHAT'S TO BE PROCESSED, ANY BLANK LINE SHOULD
// GO AFTER THE REQUIRES BELOW.
//
//= require jquery
//= require_tree .


function interprete_json(div_canvases_id){

    var toolbox_div = document.getElementById('toolbox');
    var cur_pos_div = document.getElementById('cur_pos');
    var div_c = document.getElementById(div_canvases_id);
    
    var h = {
    y: 0,
    offset_y_canvas_header :10,
    y_page:0,
    width_label_margin: 200,
    header_height: 100,
    default_height_track_line:20,
    height_track_spacer:20,
    height_feature:12,
    margin_after_region:100,
    canvas_id:'canvas',
    offset_x: 10,
    offset_x_page:8,
    offset_y: 50,
    elements:[],
    grid_elements:[],
    list_height:[],
    canvases:[],
    contexts:[],
    list_width:[],
    cur_bloc:null,
    cur_track:null,
    rect:{},
    drag:false
    };


    // set track parameters
    tracks = set_track_params(h);

    // compute canvas size

    var width=0;
    var height=0;
    for (var i=0; i<regions.length; i++){
        var bloc = regions[i];
    var bloc_height=0;
    h.list_height[i]=[];
        if (bloc[0]['bloc_type']=='assembly_specific'){
        h.list_width[i] = compute_size_regions(bloc[1]);        
        var s = sum(h.list_width[i]) + h.list_width[i].length * h.margin_after_region; 
        if (width < s){
        width=s;
        }
        for (var j=0; j< tracks[i].length; j++){
        var track =  tracks[i][j];
        var max_height=0;
        var track_regions = track[3];
        for (var k=0; k< track_regions.length; k++){   
            //alert(j + ',' +  k + "->" + track_regions[k].length);
            var tmp_height = track_regions[k].length * track[2]['height_track_line'];
            if (tmp_height > max_height){
            max_height = tmp_height;            
            }
        }
        h.list_height[i][j]=max_height + h.height_track_spacer;
        if (h.list_height[i][j] > 32767){
            //alert('Canvas maximum size exceeded for track ' +  j);
            h.list_height[i][j] = 32767; 
        }
        height += h.list_height[i][j]; 
        }
        }
    }
    
    // create canvases
    
    for (var i=0; i<regions.length; i++){       
    if  (regions[i][0]['bloc_type']=='assembly_specific'){
        h.cur_bloc=i;
        h.canvases[i]=[];
        h.contexts[i]=[];
        // create header track
        h.cur_track=0;
        h.canvases[i][0]=[];
        h.contexts[i][0]=[];
        h = create_canvas(div_c, width , h.header_height, h.header_height, h);
        for (var j=0; j< tracks[i].length; j++){
        h.canvases[i][j+1]=[];
        h.contexts[i][j+1]=[];
        h.cur_track=j+1;
        var height_div = (tracks[i][j][2].height) ? tracks[i][j][2].height : h.list_height[i][j];       
        h = create_canvas(div_c, width, h.list_height[i][j], height_div, h); 
        }
    }
    }
    
    //do listener on canvases

    for (var i=0; i<regions.length; i++){
    if  (regions[i][0]['bloc_type']=='assembly_specific'){
        h.elements[i]=[];
        for (var j=-1; j< tracks[i].length; j++){
        h.elements[i][j+1]=[];
                
        var c_id = "#" + [i, j+1].join('_');
        if (j>-1){              
            $(c_id).click({h: h, i:i, j:j+1}, function(e) {
                var h = e.data.h;
                var i = e.data.i;
                var j = e.data.j;
                var x = e.pageX -h.offset_x_page - h.width_label_margin,
                y = e.pageY  - h.offset_y + compute_scroll_shift(i, j+1);
                
                for(var l=0; l<h.elements[i][j].length; l++){
                if (y > h.elements[i][j][l].y_page && y < h.elements[i][j][l].y_page + h.elements[i][j][l].height
                    && x > h.elements[i][j][l].left && x < h.elements[i][j][l].left + h.elements[i][j][l].width) {
                    var fields = {'name' : 'Name', 'mask' : 'Alignment mask', 'seq' : 'Sequence', 'i' : 'Indice'};
                    var desc = "<table>";
                    for (var m in fields){
                    var val = h.elements[i][j][l].subfeature[2][m];
                    if (m=='seq'){
                        val='';
                        var tmp_t =  h.elements[i][j][l].subfeature[2][m].split('');
                        for (var n=0; n<tmp_t.length; n++){
                        val+=tmp_t[n];
                        if (n%30 ==0 && n>0){
                            val+='<br/>';
                        }
                        }
                    }
                    desc+="<tr><td>" + fields[m] + "</td><td>" + val + "</td></tr>";
                    }
                    desc += "</table>"; 
                    var e = document.getElementById("feature_desc");
                    e.innerHTML= desc;
                }
                }
            });
        }
        /*  $(div_id).scroll({h:h, i: i, j: j+1}, function(e) {
            // reinitialize resize widget
            alert(div_id);
            $(div_id).resizable( "destroy" );
            $(div_id).resizable({ handles: "s", maxHeight: height });
                
            })
        */
        $(c_id).mousemove({h:h, i: i, j: j+1}, function(e) {
            var h = e.data.h;
            var x = e.pageX -h.offset_x_page - h.width_label_margin;
            
            var i = e.data.i;
                        var j = e.data.j;
            var y = e.pageY - h.offset_y + compute_scroll_shift(i, j+1);
            var c=  h.canvases[i][j];

            var bloc_id = guess_bloc(y-h.header_height, h);
            
            var res = guess_region(bloc_id, x-h.offset_x, h);
            var cur_bloc_desc = regions[bloc_id][0]['genome_name'] + " on chromosome " + regions[bloc_id][1][res[0]][0] + ", pos=" + res[1]; 
            var pos= 0;
            var cur_feature = 'NA';
            var flag=0;
            
            for(var l=0; l<h.elements[i][j].length; l++){
                if (y > h.elements[i][j][l].y_page && y < h.elements[i][j][l].y_page + h.elements[i][j][l].height
                && x > h.elements[i][j][l].left && x < h.elements[i][j][l].left + h.elements[i][j][l].width) {
                c.style.cursor='pointer';
                cur_feature = h.elements[i][j][l].subfeature[2].name;
                flag=1;
                break;
                }
            }
            if (flag==0){
                c.style.cursor='';
            }
            $("#cur_pos").html('Position: ' + cur_bloc_desc + '<br/>Track: ' + (( tracks[i][j-1]) ? tracks[i][j-1][0] : 'NA') + '<br/>Feature: ' + cur_feature) ;
            
            });
        
        // create event listener for canvas selection
                c_id = "#" + ['select', i, j+1].join('_');
                if (j>-1){
                    $(c_id).mousedown({h: h, i:i, j:j+1}, function(e) {
                h.rect.startX = e.pageX - this.offsetLeft;
                h.rect.startY = e.pageY - this.offsetTop;
                h.drag = true;
            });
            $(c_id).mouseup({h: h, i:i, j:j+1}, function(e) {
                h.drag = false;
                        });
            $(c_id).mousemove({h: h, i:i, j:j+1}, function(e) {
                var c = h.canvases[i][j] 
                if (h.drag) {
                h.rect.w = (e.pageX - this.offsetLeft) - rect.startX;
                h.rect.h = (e.pageY - this.offsetTop) - rect.startY ;
                h.contexts[i][j].clearRect(0,0,c.width,c.height);
                h.contexts[i][j].fillStyle = "#eeeeee";
                h.contexts[i][j].fillRect(h.rect.startX, h.rect.startY, h.rect.w, h.rect.h);
                }
                        });
        }
        }
    } 

    // create canvas for selection and associated listeners
    
    c_id = "#" + 'selection_canvas';
    if (j>-1){
        $(c_id).mousedown({h: h, i:i, j:j+1}, function(e) {
            h.rect.startX = e.pageX - this.offsetLeft;
            h.rect.startY = e.pageY - this.offsetTop;
            h.drag = true;
        });
        $(c_id).mouseup({h: h, i:i, j:j+1}, function(e) {
            h.drag = false;
        });
        $(c_id).mousemove({h: h, i:i, j:j+1}, function(e) {
                            var c = h.canvases[i][j]
                if (h.drag) {
                    h.rect.w = (e.pageX - this.offsetLeft) - rect.startX;
                    h.rect.h = (e.pageY - this.offsetTop) - rect.startY ;
                    h.contexts[i][j].clearRect(0,0,c.width,c.height);
                    h.contexts[i][j].fillStyle = "#eeeeee";
                    h.contexts[i][j].fillRect(h.rect.startX, h.rect.startY, h.rect.w, h.rect.h);
                }
        });
    }

    // render elements 
  
    for (var i=0; i<regions.length; i++){
        var bloc = regions[i];
        if (bloc[0]['bloc_type']=='assembly_specific'){
        h.cur_bloc=i;
        h = draw_sa_bloc(h, bloc, tracks[i]);       
        
        for (var j=0; j< tracks[i].length+1; j++){
            render_elements(h.contexts[i][j], h.grid_elements);
            render_elements(h.contexts[i][j], h.elements[i][j]);
        }   
        }
    }
    }
}

function  set_track_params(h){

    for (var i=0; i<regions.length; i++){
    for (var j=0; j< tracks[i].length; j++){
        var track = tracks[i][j];
        if (!track[2]['height_track_line']){
        tracks[i][j][2]['height_track_line']=h.default_height_track_line;
        }
    }
    }
    return tracks;
}

function compute_scroll_shift(i, j){

    var scroll_shift = 0;
    // var canvases = document.getElementById('canvases');
    // var list_div=canvases.childNodes;
    //alert(regions.length);
    for (var k=0; k<regions.length; k++){         
    for (var l=0; l<tracks[k].length; l++){     
        scroll_shift += document.getElementById('div_canvas_' + k + "_" + (l+1)).scrollTop; 
        if (k == i && l == j){
        break;
        }
    }
    }
    return scroll_shift;

}

function create_canvas(container_div, width, height, height_div, h){

    var id = [h.cur_bloc, h.cur_track].join("_");
    var div = document.createElement('div');
    div.id ="div_" + id;

    container_div.appendChild(div);

    var div_label = document.createElement('div');
    div_label.id="div_label_" + id;
    if (h.cur_track>0){ // track label
        //add_label(h.cur_bloc, h.cur_track, text);
        div_label.className='track_label';
        div_label.innerHTML=tracks[h.cur_bloc][h.cur_track-1][0];
        div.appendChild(div_label);
    }else{ // bloc_label
        div_label.className='bloc_label';
        bloc = regions[h.cur_bloc];
        div_label.innerHTML=bloc[0]['genome_name'] + " [" + bloc[0]['assembly'] + "]";      
    }
    div.appendChild(div_label);
        
    var div_canvas = document.createElement('div');
    div_canvas.id ="div_canvas_" + id;
    div_canvas.style.height=height_div + "px";
    div_canvas.style.position='relative';
    div_canvas.style.left=h.width_label_margin + "px";
        if (height_div < height){
            div_canvas.className='scrollable';
        }
    
    div.appendChild(div_canvas);
    
    var e = document.createElement('canvas');      
    e.id = id ;         
    e.width=width;                                                  
    e.height=height;                           
    div_canvas.appendChild(e);
    h.canvases[h.cur_bloc][h.cur_track] = e;
    h.contexts[h.cur_bloc][h.cur_track] =  h.canvases[h.cur_bloc][h.cur_track].getContext('2d');
    return h;
}

function guess_bloc(y, h){
    var i=0;
    var s= sum(h.list_height[i]);
    while (i<h.list_height.length && s<y){
    i++;
    s = sum(h.list_height[i]);
    }
    return i;
}

function guess_region(bloc_id, x, h){
    var i=0;
    var s= h.list_width[bloc_id][i] + h.margin_after_region;
    while (i<h.list_width[bloc_id].length && s < x){
    i++;
    s += h.list_width[bloc_id][i] + h.margin_after_region;
    }
    var region = regions[bloc_id][1][i];
    // alert( parseInt((x - (s- h.list_width[bloc_id][i] - h.margin_after_region))*(region[2]-region[1])/h.list_width[bloc_id][i]));
    //    alert(x + ", " + (s- h.list_width[bloc_id][i] - h.margin_after_region));
    //    alert((region[2]-region[1]) + ", " + h.list_width[bloc_id][i]);
    var p = region[1] + parseInt((x - (s- h.list_width[bloc_id][i] - h.margin_after_region))*(region[2]-region[1])/h.list_width[bloc_id][i]);
    //alert(p);
    if (p < region[1] || p > region[2]){
    p = 'NA'
    }
    return [i, p];
}

function draw_sa_bloc(h, bloc, bloc_tracks){

    var x=h.offset_x;

    var total_size=1300;
    h.l_size_regions = compute_size_regions(bloc[1]);
    var size_all_regions = sum(h.l_size_regions);
    
    // header
    
    var text= bloc[0]['genome_name'] + " [" + bloc[0]['assembly'] + "]";
  
    for (var i=0; i<bloc[1].length; i++){       
    var region = bloc[1][i];
    var text =  "chromosome " + region[0] + " [" + region[1] + "-" + region[2] + "]";
    h.elements[h.cur_bloc][0].push({
        color: 'green',
            fontSize:'16px',
            text: text,
            desc: "",
            top: h.y + h.offset_y_canvas_header,
            left: x,
            });

    //create scale
    draw_scale(h, x, h.l_size_regions[i], region);
    
    x+=h.l_size_regions[i] + h.margin_after_region;

    }

    h.y = h.default_height_track_line; //h.header_height;
    h.y_page += h.header_height;
    for (var j=0; j< bloc_tracks.length; j++){
    var track = bloc_tracks[j];
    x=h.offset_x;
        //var text = track[0];
    //  var tmp_h = (j==0) ? h.header_height : h.list_height[h.cur_bloc][j-1];
    //       add_label('track_label_' + h.cur_bloc + "_" + j,  text, 'track_label', h.offset_y + h.y_page)

        //  x+=h.width_label_margin;
    draw_track(h, track, bloc, x, j+1);
    h.y_page += h.list_height[h.cur_bloc][j];
    }
    return h;
}    

function compute_size_regions(regions){
    
    var l_size =[];
    for (var i=0; i<regions.length; i++){
        var region = regions[i];
    l_size.push((region[2]-region[1]) / (Math.pow(10,(region[3]-2))));
    }
    return l_size;
}

function sum(l){
    var x =0;
    var s = l.length;
    for (var i=0; i<s; i++){
    x+=l[i];
    }
    return x
}

function draw_scale(h, x, width, region){
    h.elements[h.cur_bloc][0].push({
        type: 'line',
        color: 'green',
        top:  h.offset_y_canvas_header+40,
        left: x,
        width: width,
        height:2
    });
    for (var i=0; i<width+10; i+=10){
    var p1 = 30; 
    var p2 = 10;
    h.grid_elements.push({
            color: '#dddddd',
            top: 0,
            left: x+i,
            width: 1,
            height: sum(h.list_height[h.cur_bloc])
            });

    if (i % 100 != 0){
        p1=35;
        p2=5;
    }else{
        h.elements[h.cur_bloc][0].push({
            text: format_genomic_pos(region[1] + i * Math.pow(10,(region[3]-2))),
            color: 'green',
            top: h.offset_y_canvas_header+20,
            left: x+i
          });
    }
    h.elements[h.cur_bloc][0].push({
        color: 'green',
            top: h.offset_y_canvas_header+p1,
            left: x+i,
            width: 1,
            height:p2
            });
    }
    return h;
}

function format_genomic_pos(a){
    var p =[a].join("").split('');
    var text = '';
    for( var i=p.length-1; i>-1; i--){//>0){
    if ((p.length-i-1)%3==0 && i != p.length-1){
        text="'" + text;
    }
    text= p[i] + text;
    }
    return text;
}

function draw_track(h, track, bloc, x, track_id){
    var num = 0;
    for (var i=0; i<track[3].length; i++){  // each region
    var region = bloc[1][i];
    var tmp_y = h.y;
    var tmp_y_page= h.y_page + h.y;
    for (var j=0; j<track[3][i].length; j++){ // track_lines
        for (var k=0; k<track[3][i][j].length; k++){ // features
        for (var l=0; l<track[3][i][j][k][0].length; l++){ // subfeatures
            num++;

                var subfeature = track[3][i][j][k][0][l];
            
            var left = x+ (subfeature[0]-region[1]) / Math.pow(10,(region[3]-2));
            //alert(x + " -> " +left);
            var width = (subfeature[1]-subfeature[0]) / Math.pow(10,(region[3]-2));
            if (region[1]> subfeature[0]){
                left=x;
                width =(subfeature[1]-region[1]) / Math.pow(10,(region[3]-2));
            }

            height_feature = (track[2].default_height_feature) ? track[2].default_height_feature : h.height_feature;
            if (height_feature > track[2].height-3){
                height_feature = track[2].height-3
            } 
            
            h.elements[h.cur_bloc][track_id].push({
                color: '#99ff99',
                    desc: subfeature[2].name,
                    subfeature:subfeature,
                    y_page:tmp_y_page-height_feature,
                    top: tmp_y-height_feature,
                    left: left, //x+ (subfeature[0]-region[1]) / Math.pow(10,(region[3]-2)),
                    width: width, //(subfeature[1]-subfeature[0]) / Math.pow(10,(region[3]-2)),
                    height:height_feature+2
                    });
            
            // draw sequence                                                                                                        
            if (subfeature[2].seq){
                var tmp_seq = subfeature[2].seq;
                /*  
                tmp_color=[];
                for (var m=0; m<subfeature[1]-subfeature[0]; m++){
                tmp_color[m]='white';
                }*/
                if (subfeature[2].mut_pos){
                
                //    alert([ x+ (subfeature[0]-region[1] + subfeature[2].mut_pos) / Math.pow(10,(region[3]-2)),  1 / Math.pow(10,(region[3]-2)), h.height_feature+2,  tmp_y_page - h.height_feature, tmp_y - h.height_feature].join(" "));
                var w = 1 / Math.pow(10,(region[3]-2));
                h.elements[h.cur_bloc][track_id].push(
                                      {         
                                      color: 'red',
                                          desc: "mut " + region[1] + " : " + subfeature[0] + "->" + subfeature[1],
                                          top: tmp_y - height_feature,
                                          y_page: tmp_y_page - height_feature,
                                          left: x+ (subfeature[0]-region[1] + subfeature[2].mut_pos) / Math.pow(10,(region[3]-2)),
                                          width: (w<1) ? 1 : w,
                                          height:height_feature+2
                                          }
                                      );
                } 
                
                if (region[3]==1){
                for (var m=0; m<subfeature[1]-subfeature[0]; m++){
                    //alert( subfeature[2].seq[m] + " -> " + x + " " + (subfeature[0]-region[1]+m));
                    
                    h.elements[h.cur_bloc][track_id].push({
                        textColor:'orange',
                        fontSize : (height_feature+4) + 'px',
                        text : subfeature[2].seq[m],                        
                        top: tmp_y,
                        left: x+ (subfeature[0]-region[1]+m) / Math.pow(10,(region[3]-2))
                        });
                } 
                }
            }
        }
        }
        tmp_y+=track[2].height_track_line;
        tmp_y_page +=track[2].height_track_line;
    }
    
    x+=h.l_size_regions[i] + h.margin_after_region;
    }
}

function draw_rectangle(c, x1, y1, x2, y2) { var a = c.getContext("2d"); a.fillRect(50, 25, 150, 100);}
function draw_text(c, t, x, y) { 
    var a = c.getContext("2d");  
    a.font = "bold 10px sans-serif"; 
    a.fillText(t, x, y);
    return a;
}

function add_element(elements, h){
    elements.push(h);
}

function add_box_div(div, text, div_class, h){
    var d = document.createElement('div');
    d.className=div_class;
    d.innerHTML=text;    
    if (h['width'] != undefined){
    d.style.width=h['width'] + 'px';
    }
    div.appendChild(d);
    return d
}


function render_elements(context, elements){

    //    alert(elements.length);
    elements.forEach(function(element) {

        var tl = [];
        tl.push(element.fontStyle || "");
        tl.push(element.fontWeight || "");
        tl.push(element.fontSize || "10px");
        tl.push(element.fontFamily || "Courier New");
        context.font=  tl.join(" ");
        if (element.text){
        context.fillStyle = element.textColor || 'blue';
        if (element.width && element.height){
            context.fillText(element.text, element.left, element.top);
        }else{
            context.fillText(element.text, element.left, element.top);
        }
        }
        if (element.width && element.height){
        context.fillStyle = element.color || 'black';
        context.fillRect(element.left, element.top, element.width, element.height);
        }
    });


}

function add_label(id,  text, cl, top){
    var d = document.createElement('div');
    d.className=cl;
    d.id=id;
    d.style.top=top + "px";
    d.innerHTML=text;
    var div_track_labels=document.getElementById('track_labels');
    div_track_labels.appendChild(d);
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    var words = text.split('');
    var line = '';

    for(var n = 0; n < words.length; n++) {
    var testLine = line + words[n] + ' ';
    var metrics = context.measureText(testLine);
    var testWidth = metrics.width;
    if(testWidth > maxWidth) {
            context.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
    }
    else {
            line = testLine;
    }
    }
    context.fillText(line, x, y);
}
