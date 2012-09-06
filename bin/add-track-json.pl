#!/usr/bin/env perl
use strict;
use warnings;

use Pod::Usage;

use JSON 2;

@ARGV or pod2usage( -verbose => 2 );

# read in the JSON
my $j = JSON->new->relaxed->pretty;
my $json_fh =
    @ARGV == 1 ? \*STDIN : do {
        my $file = shift @ARGV;
        open( my $fh, '<', $file ) or die "$! reading $file";
        $fh
    };
my $track_data = $j->decode( do{ local $/; scalar <$json_fh> } );

# validate the track JSON structure
$track_data->{label} or die "invalid track JSON: missing a label element\n";

# read and parse the target file
my $target_file = shift @ARGV or pod2usage();
my $target_file_data = eval {
    $j->decode( do {
        open my $f, '<', $target_file or die "$! reading $target_file";
        local $/;
        scalar <$f>
    });
}; if( $@ ) {
    die "error reading target file: $@\n";
}

for( my $i = 0; $i < @{$target_file_data->{tracks}|| []}; $i++ ) {
    my $track = $target_file_data->{tracks}[$i];
    if( $track->{label} eq $track_data->{label} ) {
        $target_file_data->{tracks}[$i] = $track_data;
        undef $track_data;
    }
}

if( $track_data ) {
    push @{ $target_file_data->{tracks} ||= [] }, $track_data;
}

{
    open my $fh, '>', $target_file or die "$! writing $target_file";
    print $fh $j->encode( $target_file_data );
}


__END__

=head1 NAME

add-track-json.pl - add a single JSON track configuration snippet(from STDIN
or from a file) to the given JBrowse configuration file

=head1 DESCRIPTION

Reads a block of JSON describing a track from a file or from standard
input or from a file, and adds it to the target JBrowse configuration
file.

For example, if you wanted to add a sequence track to
data/trackList.json, you could run something like:

  echo ' { "urlTemplate" : "seq/{refseq}/",
           "label" : "DNA",
           "type" : "SequenceTrack"
         } ' | bin/add-track-json.pl data/trackList.json


=head1 USAGE

  bin/add-track-json.pl myTrack.json data/trackList.json

  # OR

  cat track.json | bin/add-track-json.pl data/trackList.json

=head2 OPTIONS

none yet

=cut
