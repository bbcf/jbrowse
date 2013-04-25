# -*- coding: utf-8 -*-
# Transform a gtf containing genes into a gtf with proteins:
# basically we need to regroup all exons that belongs to the same gene
# on a "parent" feature. This "parent" feature doesn't exist on traditionnal GTF, but are needed by JBrowse
# to diplay subfeatures.
# Some option are provided to filter gtf lines.
#
# e.g:
# python bin/genes2proteins.py -g CDS test-data/genes.gff


import csv
import os


def transform(inpath, outpath=None, skipfeatures=None, getfeatures=None, **csv_opts):
    """
    Transform the "genes" to "proteins". Assume the gtf file is sorted :features that belongs
    to the same gene are grouped together (it's usually the case).
    param: inpath: the path of the gtf/gff file.
    param: outpath: the path of the output file. If not specified, same filename as input + pz before the extension.
    param: skipfeatures: if you don't want to take in account some features. It can be a list or a str. (optionnal)
    param: getfeatures: if you want to take only some features. it can be a list or a str. (optionnal)
    param: csv_opts: parameters to pass to the csv reader (look for csv module in python).
    warning: 'skipfeatures' & 'getfeatures' cannot be used together. getfeatures is the strongest ;)
    """
    # prepare options
    if skipfeatures and isinstance(skipfeatures, str):
        skipfeatures = [skipfeatures]
    if getfeatures and isinstance(getfeatures, str):
        getfeatures = [getfeatures]
        skipfeatures = None
    if not outpath:
        fname, ext = os.path.splitext(inpath)
        outpath = '%s-pz%s' % (fname, ext)

    # ids tags : usually, exons, CDS, ... are attached with an 'id' attributes. Here a list with different guesses
    IDS = ['gene_id', 'group_id', 'group', 'transcript_id', 'exon_id']

    # prepare filter function
    def _filter(tag, skipfeatures=None, getfeatures=None):
        if skipfeatures:
            return tag not in skipfeatures
        elif getfeatures:
            return tag in getfeatures
        return True

    # prepare get attributes function for the gtf field n°9
    def _getattr(tag):
        d = {}
        for x in tag.split(';'):
            k = x.strip().split()
            if len(k) == 2:
                val = k[1]
                # skip extra quotes in the attributes
                if val[0] == '"' or val[0] == "'":
                    val = val[1:]
                if val[-1] == '"' or val[-1] == "'":
                    val = val[:-1]
                # skip dots as Jbrowse doesn't like them
                #val = val.replace('.', '')
                d[k[0].lower()] = val
        return d

    # write in output file
    def _woutput(out, previous):
        out.write('%s\n' % '\t'.join((previous['seqname'], previous['source'],
                                     'protein', previous['start'], previous['end'],
                                      previous['score'], previous['strand'], previous['frame'],
                                     'ID=%s' % previous['id'])))
        for line in previous['lines']:
            out.write('%s\n' % '\t'.join(line))

    # dummy function
    def _init_previous(d, theid, row):
        d['id'] = idattr
        d['seqname'] = row[0]
        d['source'] = row[1]
        d['feature'] = row[2]
        d['start'] = row[3]
        d['end'] = row[4]
        d['score'] = row[5]
        d['strand'] = row[6]
        d['frame'] = row[7]
        d['group'] = row[8]
        previous['lines'] = [row]

    # main
    with open(outpath, 'w') as outfile:
        with open(inpath, 'rb') as infile:
            reader = csv.reader(infile, **csv_opts)
            previous = {}  # dummy object to remember the previous lines

            for line_nb, row in enumerate(reader):
                # filter rows
                if _filter(row[2], skipfeatures, getfeatures):
                    attrs = _getattr(row[8])
                    idattr = False

                    # find the id
                    for theid in IDS:
                        if not idattr and theid in attrs:
                            idattr = attrs[theid]
                    if not idattr:
                        print '[x] Warning :: line %s :: id not found for the feature %s.' % (line_nb, ', '.join(row))
                    else:
                        attrs['Parent'] = idattr
                        row[8] = ';'.join(['%s=%s' % (k, v) for k, v in attrs.iteritems()])
                        if not 'id' in previous:
                            _init_previous(previous, idattr, row)
                        else:
                            if idattr == previous['id']:
                                previous['start'] = min(previous['start'], row[3])
                                previous['end'] = max(previous['end'], row[4])
                                previous['lines'].append(row)
                            else:
                                _woutput(outfile, previous)
                                _init_previous(previous, idattr, row)

            if previous:
                _woutput(outfile, previous)

    # with open(outpath, 'w') as outfile:
    #     pass


if __name__ == '__main__':
    import sys
    import getopt
    opts, args = getopt.getopt(sys.argv[1:], 'o:s:g:')
    if len(args) < 1:
        raise Exception("You must give the gff/gtf file as first arg.")
    fpath = args[0]
    outpath = None
    skipfeatures = None
    getfeatures = None
    for opt in opts:
        if 'o' in opt[0]:
            outpath = opt[1]
        elif 's' in opt[0]:
            skipfeatures = opt[1]
            if ',' in skipfeatures:
                skipfeatures = skipfeatures.split(',')
        elif 'g' in opt[0]:
            getfeatures = opt[1]
            if ',' in getfeatures:
                getfeatures = getfeatures.split(',')
    csv_opts = {'delimiter': '\t'}
    transform(fpath, outpath, skipfeatures, getfeatures, **csv_opts)
