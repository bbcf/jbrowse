# Python program to generate a json file and some statistics from a bam file

from bbcflib import genrep
from bbcflib.btrack import track
from random import random
try:
    import simplejson as json
except ImportError:
    import json
import os
import sys
import time

###################################

def region(chr, start, end, scale):
    return [chr, start, end, scale]

def block(chr, start, end, scale, genome_name, assembly, assembly_id):
    return [{'bloc_type': 'assembly_specific', 'genome_name': genome_name, 'assembly': assembly, 'assembly_id': assembly_id}, [region(chr, start, end, scale)]]

def blocks(chr, start, end, scale, genome_name, assembly, assembly_id):
    return [block(chr, start, end, scale, genome_name, assembly, assembly_id)]

###################################

def subfeature(read):
    return read

def subfeatures(read):
    return [subfeature(read)]

def feature(read):
    return [subfeatures(read), {}]

def track_line(reads):
    return [feature(reads[k]) for k in range(len(reads))]

def track_lines(reads):
    return [track_line(reads[k]) for k in range(len(reads))]

def regions_idx(reads):
    return [track_lines(reads)]

def mytrack(mytrack_name, mytrack_class, h, reads):
    return [mytrack_name, mytrack_class, h, regions_idx(reads)]

def tracks(reads, sequence, start, end):
    return [
        mytrack('Sequence', 'qualitative_class', {'color': 'blue'}, [[[start, end, {'seq': sequence}]]]),
        mytrack('Reads', 'qualitative_class', {'color': 'green'}, reads)
        ]

def blocks_idx(reads, sequence, start, end):
    return [tracks(reads, sequence, start, end)]

###################################

def generate_json(chr, position, file_name, species, L=1000, zoom=2):
    start_time = time.time()
    t_bam = track(file_name, assembly=species)
    #a = genrep.Assembly(assembly=t_bam.assembly.name)
    #sequence = a.fasta_from_regions([[chr, position-L, position+L]], out={}, path_to_ref=path)[0][chr][0]
    sequence = ""
    reads = []
    ends = {} # dictionary of the form {line_number: rightmost_read_end}
    nb_reads = 0 # number of reads that have been placed
    nb_lines = 0 # number of lines containing reads
    guess_fit_line = 0 # existing line where we guess there is the most space to put the next read (the is the case if all the reads have the same length)
    list_reads = t_bam.fetch(chr, position-L, position+L)
    
    for alignedread in list_reads:
        name = alignedread.qname
        start = alignedread.pos
        mask = str(alignedread.cigar).replace('(', '[').replace(')', ']') #[a,b] = b x operation a (a=0: M, a=1: I)
        end = alignedread.pos + alignedread.qlen
        seq = alignedread.seq
        
        i = 0 # line in which we will place the current read
        if nb_reads == 0:
            reads.append([]) # create a new line
            nb_lines += 1
            ends[0] = end
            guess_fit_line = 0
        elif start > ends[0]:
            i = 0
            ends[0] = end
            if (nb_lines-1) > 0:
                guess_fit_line = 1
        elif start > ends[guess_fit_line]: # can we put the next read in the line "guess_fit_line" ?
            i = guess_fit_line
            ends[i] = end
            if (nb_lines-1) > i:
                guess_fit_line = i + 1
        else:
            reads.append([])  # create a new line to put the next read
            i = nb_lines
            nb_lines += 1
            ends[i] = end
        reads[i].append([start, end, {'seq': seq, 'mask': mask, 'name': name}])
        nb_reads+=1
        
    g = genrep.GenRep()
    genome_name = g.assemblies_available(species)
    json1 = blocks(chr, position-L, position+L, zoom, genome_name, t_bam.assembly.name, t_bam.assembly.id)
    json2 = blocks_idx(reads, sequence, position-L, position+L)
    t_bam.close()
    elapsed_time = time.time() - start_time
    print "nreads: %s (%s)" % (nb_reads, elapsed_time)
    #    with open('/srv/gviz_sophia/lib/bam_viewer.txt', 'w') as file_out:
    return json.dumps([json1, json2], separators=(',', ':'))
    #    file_out.write(result)
    #for file in path.values():
    #os.unlink(file)
        
    #return [nb_reads, elapsed_time]
    
# Main program
if __name__ == "__main__":
    bam_file = sys.argv[1]
    species = sys.argv[2]
    window_size = int(sys.argv[3])
    chr_number = sys.argv[4]
    position = int(sys.argv[5])
    zoom = int(sys.argv[6])
    #file_stat = open('stat_fast.txt', 'a')
    rslt = generate_json(chr_number, position, bam_file, species, window_size/2, zoom)
