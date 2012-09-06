define( [
            'dojo/_base/declare',
            'dojo/_base/lang',
            'dojo/_base/array',
            'dojo/dom-geometry',
            'dojo/on',
            'dojo/aspect',
            'dijit/Menu',
            'dijit/Dialog',
            'dijit/PopupMenuItem',
            'dijit/MenuItem',
            'JBrowse/View/Track/BlockBased',
            'JBrowse/View/Track/YScaleMixin',
            'JBrowse/Util',
            'JBrowse/View/GranularRectLayout'
        ],
      function( declare,
                lang,
                array,
                domGeom,
                on,
                aspect,
                dijitMenu,
                dijitDialog,
                dijitPopupMenuItem,
                dijitMenuItem,
                BlockBased,
                YScaleMixin,
                Util,
                Layout
              ) {

var HTMLFeatures = declare( BlockBased,

 /**
  * @lends JBrowse.View.Track.HTMLFeatures.prototype
  */
{

    /**
     * A track that draws discrete features using `div` elements.
     * @constructs
     * @extends JBrowse.View.Track.BlockBased
     * @param args.config {Object} track configuration. Must include key, label
     * @param args.refSeq {Object} reference sequence object with name, start,
     *   and end members.
     * @param args.changeCallback {Function} optional callback for
     *   when the track's data is loaded and ready
     * @param args.trackPadding {Number} distance in px between tracks
     */
    constructor: function( args ) {
        var config = args.config;
        BlockBased.call( this, config.label, config.key,
                         false, args.changeCallback);
        this.fields = {};
        this.refSeq = args.refSeq;

        //number of histogram bins per block
        this.numBins = 25;
        this.histLabel = false;
        this.padding = 5;
        this.trackPadding = args.trackPadding;

        this.config = config;

        // this featureStore object should eventually be
        // instantiated by Browser and passed into this constructor, not
        // constructed here.
        this.featureStore = args.store;

        // connect the store and track loadSuccess and loadFailed events
        // to eachother
        dojo.connect( this.featureStore, 'loadSuccess', this, 'loadSuccess' );
        dojo.connect( this.featureStore, 'loadFail',    this, 'loadFail' );

        // initialize a bunch of config stuff
        var defaultConfig = {
            description: true,
            style: {
                className: "feature2",
                histScale: 4,
                labelScale: 30,
                subfeatureScale: 80,
                maxDescriptionLength: 70,
                descriptionScale: 170
            },
            hooks: {
                create: function(track, feat ) {
                    return document.createElement('div');
                }
            },
            events: {
                click: (this.config.style||{}).linkTemplate
                    ? { action: "newWindow", url: this.config.style.linkTemplate }
                    : { action: "contentDialog", content: dojo.hitch( this, 'defaultFeatureDetail' ) }
            },
            menuTemplate: [
                { label: 'View details',
                  action: 'contentDialog',
                  iconClass: 'dijitIconTask',
                  content: dojo.hitch( this, 'defaultFeatureDetail' )
                }
            ]
        };
        Util.deepUpdate(defaultConfig, this.config);
        this.config = defaultConfig;

        this.eventHandlers = (function() {
            var handlers = dojo.clone( this.config.events || {} );
            // find conf vars that set events, like `onClick`
            for( var key in this.config ) {
                var handlerName = key.replace(/^on(?=[A-Z])/, '');
                if( handlerName != key )
                    handlers[ handlerName.toLowerCase() ] = this.config[key];
            }
            // interpret handlers that are just strings to be URLs that should be opened
            for( key in handlers ) {
                if( typeof handlers[key] == 'string' )
                    handlers[key] = { url: handlers[key] };
            }
            return handlers;
        }).call(this);
        this.eventHandlers.click = this._makeClickHandler( this.eventHandlers.click );

        this.labelScale = this.featureStore.getDensity() * this.config.style.labelScale;
        this.subfeatureScale = this.featureStore.getDensity() * this.config.style.subfeatureScale;
        this.descriptionScale = this.featureStore.getDensity() * this.config.style.descriptionScale;;
    },

    /**
     * Request that the track load its data.  The track will call its own
     * loadSuccess() function when it is loaded.
     */
    load: function() {
        this.featureStore.load();
    },

    /**
     * Make a default feature detail page for the given feature.
     * @returns {HTMLElement} feature detail page HTML
     */
    defaultFeatureDetail: function( /** JBrowse.Track */ track, /** Object */ f, /** HTMLElement */ div ) {
        var fmt = dojo.hitch( this, '_fmtFeatureDetailField' );
        var container = dojo.create('div', { className: 'feature-detail feature-detail-'+track.name, innerHTML: '' } );
        container.innerHTML += fmt( 'Name', f.get('name') );
        container.innerHTML += fmt( 'Type', f.get('type') );
        container.innerHTML += fmt( 'Description', f.get('note') );
        container.innerHTML += fmt( 'Position', this.refSeq.name+':'+f.get('start')+'..'+f.get('end') );
        container.innerHTML += fmt( 'Strand', {'1':'+', '-1': '-', 0: undefined }[f.get('strand')] || f.get('strand') );

        var additionalTags = array.filter( f.tags(), function(t) { return ! {name:1,start:1,end:1,strand:1,note:1,subfeatures:1,type:1}[t.toLowerCase()]; });
        dojo.forEach( additionalTags.sort(), function(t) {
            container.innerHTML += fmt( t, f.get(t) );
        });

        return container;
    },
    _fmtFeatureDetailField: function( title, val, class_ ) {
        var valType = typeof val;
        if( !( valType in {string:1,number:1} ) )
            return ''; //val = '<span class="ghosted">none</span>';
        class_ = class_ || title.replace(/\s+/g,'_').toLowerCase();
        return '<div class="field_container"><h2 class="field '+class_+'">'+title+'</h2> <div class="value '+class_+'">'+val+'</div></div>';
    },

    // _autoLinkText: function( text ) {
    //     return text
    //         // GO terms like GO:12345
    //         .replace(/\b(GO:\d{5,})\b/g, '<a href="http://amigo.geneontology.org/cgi-bin/amigo/term_details?term=$1">$1</a>');
    // },

    /**
     * Make life easier for event handlers by handing them some things
     */
    wrapHandler: function(handler) {
        var track = this;
        return function(event) {
            event = event || window.event;
            if (event.shiftKey) return;
            var elem = (event.currentTarget || event.srcElement);
            //depending on bubbling, we might get the subfeature here
            //instead of the parent feature
            if (!elem.feature) elem = elem.parentElement;
            if (!elem.feature) return; //shouldn't happen; just bail if it does
            handler(track, elem, elem.feature, event);
        };
    },

    /**
     * Return an object with some statistics about the histograms we will
     * draw for a given block size in base pairs.
     * @private
     */
    _histDimensions: function( blockSizeBp ) {

        // bases in each histogram bin that we're currently rendering
        var bpPerBin = blockSizeBp / this.numBins;
        var pxPerCount = 2;
        var logScale = false;
        var stats = this.featureStore.histograms.stats;
        var statEntry;
        for (var i = 0; i < stats.length; i++) {
            if (stats[i].basesPerBin >= bpPerBin) {
                //console.log("bpPerBin: " + bpPerBin + ", histStats bases: " + this.histStats[i].bases + ", mean/max: " + (this.histStats[i].mean / this.histStats[i].max));
                logScale = ((stats[i].mean / stats[i].max) < .01);
                pxPerCount = 100 / (logScale ?
                                    Math.log(stats[i].max) :
                                    stats[i].max);
                statEntry = stats[i];
                break;
            }
        }

        return {
            bpPerBin: bpPerBin,
            pxPerCount: pxPerCount,
            logScale: logScale,
            stats: statEntry
        };
    },

    fillHist: function( blockIndex, block, leftBase, rightBase, stripeWidth ) {

        var dims = this._histDimensions( Math.abs( rightBase - leftBase ) );

        var track = this;
        var makeHistBlock = function(hist) {
            var maxBin = 0;
            for (var bin = 0; bin < track.numBins; bin++) {
                if (typeof hist[bin] == 'number' && isFinite(hist[bin])) {
                    maxBin = Math.max(maxBin, hist[bin]);
                }
            }
            var binDiv;
            for (bin = 0; bin < track.numBins; bin++) {
                if (!(typeof hist[bin] == 'number' && isFinite(hist[bin])))
                    continue;
                binDiv = document.createElement("div");
	        binDiv.className = "hist "+track.config.style.className + "-hist";
                binDiv.style.cssText =
                    "left: " + ((bin / track.numBins) * 100) + "%; "
                    + "height: "
                    + ((dims.pxPerCount * ( dims.logScale ? Math.log(hist[bin]) : hist[bin]))-2)
                    + "px;"
                    + "bottom: " + track.trackPadding + "px;"
                    + "width: " + (((1 / track.numBins) * 100) - (100 / stripeWidth)) + "%;"
                    + (track.config.style.histCss ?
                       track.config.style.histCss : "");
                binDiv.setAttribute('value',hist[bin]);
                if (Util.is_ie6) binDiv.appendChild(document.createComment());
                block.appendChild(binDiv);
            }

            track.heightUpdate( dims.pxPerCount * ( dims.logScale ? Math.log(maxBin) : maxBin ),
                                blockIndex );
            track.makeHistogramYScale( Math.abs(rightBase-leftBase) );
        };

        // The histogramMeta array describes multiple levels of histogram detail,
        // going from the finest (smallest number of bases per bin) to the
        // coarsest (largest number of bases per bin).
        // We want to use coarsest histogramMeta that's at least as fine as the
        // one we're currently rendering.
        // TODO: take into account that the histogramMeta chosen here might not
        // fit neatly into the current histogram (e.g., if the current histogram
        // is at 50,000 bases/bin, and we have server histograms at 20,000
        // and 2,000 bases/bin, then we should choose the 2,000 histogramMeta
        // rather than the 20,000)
        var histogramMeta = this.featureStore.histograms.meta[0];
        for (var i = 0; i < this.featureStore.histograms.meta.length; i++) {
            if (dims.bpPerBin >= this.featureStore.histograms.meta[i].basesPerBin)
                histogramMeta = this.featureStore.histograms.meta[i];
        }

        // number of bins in the server-supplied histogram for each current bin
        var binCount = dims.bpPerBin / histogramMeta.basesPerBin;
        // if the server-supplied histogram fits neatly into our current histogram,
        if ((binCount > .9)
            &&
            (Math.abs(binCount - Math.round(binCount)) < .0001)) {
            // we can use the server-supplied counts
            var firstServerBin = Math.floor(leftBase / histogramMeta.basesPerBin);
            binCount = Math.round(binCount);
            var histogram = [];
            for (var bin = 0; bin < this.numBins; bin++)
                histogram[bin] = 0;

            histogramMeta.lazyArray.range(
                firstServerBin,
                firstServerBin + (binCount * this.numBins),
                function(i, val) {
                    // this will count features that span the boundaries of
                    // the original histogram multiple times, so it's not
                    // perfectly quantitative.  Hopefully it's still useful, though.
                    histogram[Math.floor((i - firstServerBin) / binCount)] += val;
                },
                function() {
                    makeHistBlock(histogram);
                }
            );
        } else {
            // make our own counts
            this.featureStore.histogram( leftBase, rightBase,
                                         this.numBins, makeHistBlock);
        }
    },

    endZoom: function(destScale, destBlockBases) {
        this.clear();
    },

    updateStaticElements: function( coords ) {
        BlockBased.prototype.updateStaticElements.apply( this, arguments );
        this.updateYScaleFromViewDimensions( coords );
        this.updateFeatureLabelPositions( coords );
    },

    updateFeatureLabelPositions: function( coords ) {
        if( ! 'x' in coords || this.scale < this.labelScale )
            return;

        dojo.query( '.block', this.div )
            .forEach( function(block) {
                          // calculate the view left coord relative to the
                          // block left coord in units of pct of the block
                          // width
                          var viewLeft = 100 * ( coords.x - block.offsetLeft ) / block.offsetWidth + 2;

                          // if the view start is unknown, or is to the
                          // left of this block, we don't have to worry
                          // about adjusting the feature labels
                          if( ! viewLeft )
                              return;

                          var blockWidth = block.endBase - block.startBase;

                          dojo.query('.feature',block)
                              .forEach( function(featDiv) {
                                            if( ! featDiv.label ) return;
                                            var labelDiv = featDiv.label;
                                            var feature = featDiv.feature;

                                            // get the feature start and end in terms of block width pct
                                            var minLeft = parseInt( feature.get('start') );
                                            minLeft = 100 * (minLeft - block.startBase) / blockWidth;
                                            var maxLeft = parseInt( feature.get('end') );
                                            maxLeft = 100 * ( (maxLeft - block.startBase) / blockWidth
                                                              - labelDiv.offsetWidth / block.offsetWidth
                                                            );

                                            // move our label div to the view start if the start is between the feature start and end
                                            labelDiv.style.left = Math.max( minLeft, Math.min( viewLeft+70, maxLeft ) ) + '%';

                                        },this);
                      },this);
    },

    fillBlock: function(blockIndex, block, leftBlock, rightBlock, leftBase, rightBase, scale, stripeWidth, containerStart, containerEnd) {

        // only update the label once for each block size
        var blockBases = Math.abs( leftBase-rightBase );
        if( this._updatedLabelForBlockSize != blockBases ){
            if ( scale < (this.featureStore.getDensity() * this.config.style.histScale)) {
                this.setLabel(this.key + "<br>per " + Util.addCommas( Math.round( blockBases / this.numBins)) + " bp");
            } else {
                this.setLabel(this.key);
            }
            this._updatedLabelForBlockSize = blockBases;
        }

        //console.log("scale: %d, histScale: %d", scale, this.histScale);
        if (this.featureStore.histograms &&
            (scale < (this.featureStore.getDensity() * this.config.style.histScale)) ) {
	    this.fillHist(blockIndex, block, leftBase, rightBase, stripeWidth,
                          containerStart, containerEnd);
        } else {

            // if we have transitioned to viewing features, delete the
            // y-scale used for the histograms
            if( this.yscale ) {
                this._removeYScale();
            }

	    this.fillFeatures(blockIndex, block, leftBlock, rightBlock,
                              leftBase, rightBase, scale,
                              containerStart, containerEnd);
        }
    },

    /**
     * Creates a Y-axis scale for the feature histogram.  Must be run after
     * the histogram bars are drawn, because it sometimes must use the
     * track height to calculate the max value if there are no explicit
     * histogram stats.
     * @param {Number} blockSizeBp the size of the blocks in base pairs.
     * Necessary for calculating histogram stats.
     */
    makeHistogramYScale: function( blockSizeBp ) {
        var dims = this._histDimensions( blockSizeBp);
        if( dims.logScale ) {
            console.error("Log histogram scale axis labels not yet implemented.");
            return;
        }
        var maxval = dims.stats ? dims.stats.max : this.height/dims.pxPerCount;
        maxval = dims.logScale ? log(maxval) : maxval;

        // if we have a scale, and it has the same characteristics
        // (including pixel height), don't redraw it.
        if( this.yscale && this.yscale_params
            && this.yscale_params.maxval == maxval
            && this.yscale_params.height == this.height
            && this.yscale_params.blockbp == blockSizeBp
          ) {
              return;
          } else {
              this._removeYScale();
              this.makeYScale({ min: 0, max: maxval });
              this.yscale_params = {
                  height: this.height,
                  blockbp: blockSizeBp,
                  maxval: maxval
              };
          }
    },

    /**
     * Delete the Y-axis scale if present.
     * @private
     */
    _removeYScale: function() {
        if( !this.yscale )
            return;
        this.yscale.parentNode.removeChild( this.yscale );
        delete this.yscale_params;
        delete this.yscale;
    },

    cleanupBlock: function(block) {
        // garbage collect the layout
        if ( block && this.layout )
            this.layout.discardRange( block.startBase, block.endBase );
    },

    /**
     * Called when sourceBlock gets deleted.  Any child features of
     * sourceBlock that extend onto destBlock should get moved onto
     * destBlock.
     */
    transfer: function(sourceBlock, destBlock, scale, containerStart, containerEnd) {

        if (!(sourceBlock && destBlock)) return;

        var destLeft = destBlock.startBase;
        var destRight = destBlock.endBase;
        var blockWidth = destRight - destLeft;
        var sourceSlot;

        var overlaps = (sourceBlock.startBase < destBlock.startBase)
            ? sourceBlock.rightOverlaps
            : sourceBlock.leftOverlaps;
        overlaps = overlaps || [];

        for (var i = 0; i < overlaps.length; i++) {
	    //if the feature overlaps destBlock,
	    //move to destBlock & re-position
	    sourceSlot = sourceBlock.featureNodes[ overlaps[i] ];
	    if (sourceSlot && ("label" in sourceSlot)) {
                sourceSlot.label.parentNode.removeChild(sourceSlot.label);
	    }
	    if (sourceSlot && sourceSlot.feature) {
	        if ( sourceSlot.layoutEnd > destLeft
		     && sourceSlot.feature.get('start') < destRight ) {

                         sourceBlock.removeChild(sourceSlot);
                         delete sourceBlock.featureNodes[ overlaps[i] ];

                         var featDiv =
                             this.renderFeature(sourceSlot.feature, overlaps[i],
                                                destBlock, scale,
                                                containerStart, containerEnd, destBlock );
                     }
            }
        }
    },

    /**
     * arguments:
     * @param block div to be filled with info
     * @param leftBlock div to the left of the block to be filled
     * @param rightBlock div to the right of the block to be filled
     * @param leftBase starting base of the block
     * @param rightBase ending base of the block
     * @param scale pixels per base at the current zoom level
     * @param containerStart don't make HTML elements extend further left than this
     * @param containerEnd don't make HTML elements extend further right than this. 0-based.
     */
    fillFeatures: function(blockIndex, block, leftBlock, rightBlock, leftBase, rightBase, scale, containerStart, containerEnd) {

        this.scale = scale;

        if( ! this.layout || this.layout.pitchX != 2/scale )
            this.layout = new Layout({pitchX: 2/scale, pitchY: 10});

        block.featureNodes = {};
        block.style.backgroundColor = "#ddd";

        //determine the glyph height, arrowhead width, label text dimensions, etc.
        if (!this.haveMeasurements) {
            this.measureStyles();
            this.haveMeasurements = true;
        }

        var curTrack = this;
        var featCallback = dojo.hitch(this,function(feature, uniqueId ) {
            if( ! this._featureIsRendered( uniqueId ) ) {
                this.renderFeature( feature, uniqueId, block, scale,
                                    containerStart, containerEnd, block );
            }
        });

        // var startBase = goLeft ? rightBase : leftBase;
        // var endBase = goLeft ? leftBase : rightBase;

        this.featureStore.iterate( leftBase, rightBase, featCallback,
                                  function () {
                                      block.style.backgroundColor = "";
                                      curTrack.heightUpdate(curTrack.layout.getTotalHeight(),
                                                            blockIndex);
                                  });
    },

    /**
     * Returns true if a feature is visible and rendered someplace in the blocks of this track.
     * @private
     */
    _featureIsRendered: function( uniqueId ) {
        var blocks = this.blocks;
        for( var i=0; i<blocks.length; i++ ) {
            if( blocks[i] && blocks[i].featureNodes[uniqueId])
                return true;
        }
        return false;
    },

    measureStyles: function() {
        //determine dimensions of labels (height, per-character width)
        var heightTest = document.createElement("div");
        heightTest.className = "feature-label";
        heightTest.style.height = "auto";
        heightTest.style.visibility = "hidden";
        heightTest.appendChild(document.createTextNode("1234567890"));
        document.body.appendChild(heightTest);
        this.labelHeight = heightTest.clientHeight;
        this.labelWidth = heightTest.clientWidth / 10;
        document.body.removeChild(heightTest);

        //measure the height of glyphs
        var glyphBox;
        heightTest = document.createElement("div");
        //cover all the bases: stranded or not, phase or not
        heightTest.className =
            "feature " + this.config.style.className
            + " plus-" + this.config.style.className
            + " plus-" + this.config.style.className + "1";
        if (this.config.style.featureCss)
            heightTest.style.cssText = this.config.style.featureCss;
        heightTest.style.visibility = "hidden";
        if (Util.is_ie6) heightTest.appendChild(document.createComment("foo"));
        document.body.appendChild(heightTest);
        glyphBox = domGeom.getMarginBox(heightTest);
        this.glyphHeight = glyphBox.h;
        this.padding += glyphBox.w;
        document.body.removeChild(heightTest);

        //determine the width of the arrowhead, if any
        if (this.config.style.arrowheadClass) {
            var ah = document.createElement("div");
            ah.className = "plus-" + this.config.style.arrowheadClass;
            if (Util.is_ie6) ah.appendChild(document.createComment("foo"));
            document.body.appendChild(ah);
            glyphBox = domGeom.position(ah);
            this.plusArrowWidth = glyphBox.w;
            this.plusArrowHeight = glyphBox.h;
            ah.className = "minus-" + this.config.style.arrowheadClass;
            glyphBox = domGeom.position(ah);
            this.minusArrowWidth = glyphBox.w;
            this.minusArrowHeight = glyphBox.h;
            document.body.removeChild(ah);
        }
    },

    renderFeature: function(feature, uniqueId, block, scale, containerStart, containerEnd, destBlock ) {
        //featureStart and featureEnd indicate how far left or right
        //the feature extends in bp space, including labels
        //and arrowheads if applicable

        var featureEnd = feature.get('end');
        var featureStart = feature.get('start');
        if( typeof featureEnd == 'string' )
            featureEnd = parseInt(featureEnd);
        if( typeof featureStart == 'string' )
            featureStart = parseInt(featureStart);


        var levelHeight = this.glyphHeight + 2;

        // if the label extends beyond the feature, use the
        // label end position as the end position for layout
        var name = feature.get('name') || feature.get('ID');
        var description = this.config.description && scale > this.descriptionScale && ( feature.get('note') || feature.get('description') );
        if( description && description.length > this.config.style.maxDescriptionLength )
            description = description.substr(0, this.config.style.maxDescriptionLength+1 ).replace(/(\s+\S+|\s*)$/,'')+String.fromCharCode(8230);

        // add the label div (which includes the description) to the
        // calculated height of the feature if it will be displayed
        if( scale >= this.labelScale ) {
            if (name) {
	        featureEnd = Math.max(featureEnd, featureStart + (''+name).length * this.labelWidth / scale );
                levelHeight += this.labelHeight;
            }
            if( description ) {
                featureEnd = Math.max( featureEnd, featureStart + (''+description).length * this.labelWidth / scale );
                levelHeight += this.labelHeight;
            }
        }
        featureEnd += Math.max(1, this.padding / scale);

        var top = this.layout.addRect( uniqueId,
                                       featureStart,
                                       featureEnd,
                                       levelHeight);

        var featDiv = this.config.hooks.create(this, feature );
        this._connectFeatDivHandlers( featDiv );
        featDiv.track = this;
        featDiv.feature = feature;
        featDiv.layoutEnd = featureEnd;
        featDiv.className = (featDiv.className ? featDiv.className + " " : "") + "feature";

        block.featureNodes[uniqueId] = featDiv;

        // record whether this feature protrudes beyond the left and/or right side of the block
        if( featureStart < block.startBase ) {
            if( ! block.leftOverlaps ) block.leftOverlaps = [];
            block.leftOverlaps.push( uniqueId );
        }
        if( featureEnd > block.endBase ) {
            if( ! block.rightOverlaps ) block.rightOverlaps = [];
            block.rightOverlaps.push( uniqueId );
        }

        var strand = feature.get('strand');
        switch (strand) {
        case 1:
        case '+':
            featDiv.className = featDiv.className + " plus-" + this.config.style.className; break;
        case -1:
        case '-':
            featDiv.className = featDiv.className + " minus-" + this.config.style.className; break;
        default:
            featDiv.className = featDiv.className + " " + this.config.style.className; break;
        }

        var phase = feature.get('phase');
        if ((phase !== null) && (phase !== undefined))
            featDiv.className = featDiv.className + " " + featDiv.className + "_phase" + phase;

        // Since some browsers don't deal well with the situation where
        // the feature goes way, way offscreen, we truncate the feature
        // to exist betwen containerStart and containerEnd.
        // To make sure the truncated end of the feature never gets shown,
        // we'll destroy and re-create the feature (with updated truncated
        // boundaries) in the transfer method.
        var displayStart = Math.max( feature.get('start'), containerStart );
        var displayEnd = Math.min( feature.get('end'), containerEnd );
        var minFeatWidth = 1;
        var blockWidth = block.endBase - block.startBase;
        var featwidth = Math.max(minFeatWidth, (100 * ((displayEnd - displayStart) / blockWidth)));
        featDiv.style.cssText =
            "left:" + (100 * (displayStart - block.startBase) / blockWidth) + "%;"
            + "top:" + top + "px;"
            + " width:" + featwidth + "%;"
            + (this.config.style.featureCss ? this.config.style.featureCss : "");

        if ( this.config.style.arrowheadClass ) {
            var ah = document.createElement("div");
            var featwidth_px = featwidth/100*blockWidth*scale;

            // NOTE: arrowheads are hidden until they are centered by
            // _centerFeatureElements, so that they don't jump around
            // on the screen
            switch (strand) {
            case 1:
            case '+':
                if( featwidth_px > this.plusArrowWidth*1.1 ) {
                    ah.className = "plus-" + this.config.style.arrowheadClass;
                    ah.style.cssText = "visibility: hidden; position: absolute; right: 0px; top: 0px; z-index: 100;";
                    featDiv.appendChild(ah);
                }
                break;
            case -1:
            case '-':
                if( featwidth_px > this.minusArrowWidth*1.1 ) {
                    ah.className = "minus-" + this.config.style.arrowheadClass;
                    ah.style.cssText =
                        "visibility: hidden; position: absolute; left: 0px; top: 0px; z-index: 100;";
                    featDiv.appendChild(ah);
                }
                break;
            }
        }

        if (name && (scale >= this.labelScale)) {
            var labelDiv = dojo.create( 'div', {
                    className: "feature-label",
                    innerHTML: '<div class="feature-name">'+name+'</div>'
                               +( description ? ' <div class="feature-description">'+description+'</div>' : '' ),
                    style: {
                        top: (top + this.glyphHeight + 2) + "px",
                        left: (100 * (featureStart - block.startBase) / blockWidth)+'%'
                    }
                }, block );

            this._connectFeatDivHandlers( labelDiv );

	    featDiv.label = labelDiv;
            labelDiv.feature = feature;
            labelDiv.track = this;
            featDiv.labelDiv = labelDiv;
        }

        if( destBlock ) {
            destBlock.appendChild(featDiv);
        }


        // defer subfeature rendering and modification hooks into a
        // timeout so that navigation feels faster.
        window.setTimeout( dojo.hitch( this,
             function() {

                 if( featwidth > minFeatWidth && scale >= this.subfeatureScale ) {
                     var subfeatures = feature.get('subfeatures');
                     if( subfeatures ) {
                         for (var i = 0; i < subfeatures.length; i++) {
                             this.renderSubfeature(feature, featDiv,
                                                   subfeatures[i],
                                                   displayStart, displayEnd);
                         }
                     }
                 }

                 //ie6 doesn't respect the height style if the div is empty
                 if (Util.is_ie6) featDiv.appendChild(document.createComment());
                 //TODO: handle event-handler-related IE leaks

                 /* Temi / AP adding right menu click
                  AP new schema menuTemplate: an array where everything except
                  children, popup and url are passed on as properties to a new
                  dijit.Menu object
                  */

                 // render the popup menu if configured
                 if( this.config.menuTemplate ) {
                     this._connectMenus( featDiv );
                 }
                 if( destBlock )
                     this._centerFeatureElements(featDiv);

                 if ( typeof this.config.hooks.modify == 'function' ) {
                     this.config.hooks.modify(this, feature, featDiv);
                 }

        }),50+Math.random()*50);

        return featDiv;
    },

    /**
     * Vertically centers all the child elements of a feature div.
     * @private
     */
    _centerFeatureElements: function( /**HTMLElement*/ featDiv ) {
        for( var i = 0; i< featDiv.childNodes.length; i++ ) {
            var child = featDiv.childNodes[i];
            var h = child.offsetHeight || 0;
            dojo.style( child, { top: ((this.glyphHeight-h)/2) + 'px', visibility: 'visible' });
         }
    },


    /**
     * Connect our configured event handlers to a given html element,
     * usually a feature div or label div.
     */
    _connectFeatDivHandlers: function( /** HTMLElement */ div  ) {
        for( var event in this.eventHandlers ) {
            on( div, event, this.eventHandlers[event] );
        }
        // if our click handler has a label, set that as a tooltip
        if( this.eventHandlers.click && this.eventHandlers.click.label )
            div.setAttribute( 'title', this.eventHandlers.click.label );
    },

    _connectMenus: function( featDiv ) {
        // don't actually make the menu until the feature is
        // moused-over.  pre-generating menus for lots and lots of
        // features at load time is way too slow.
        var refreshMenu = lang.hitch( this, '_refreshMenu', featDiv );
        on( featDiv,  'mouseover', refreshMenu );
        if( featDiv.labelDiv )
            on( featDiv.labelDiv,  'mouseover', refreshMenu );
        dojo.connect( featDiv.contextMenu, 'onMouseMove', refreshMenu );
    },

    _refreshMenu: function( featDiv ) {
        // if we already have a menu generated for this feature,
        // give it a new lease on life
        if( ! featDiv.contextMenu ) {
            featDiv.contextMenu = this._makeFeatureContextMenu( featDiv, this.config.menuTemplate );
        }

        // give the menu a timeout so that it's cleaned up if it's not used within a certain time
        if( featDiv.contextMenuTimeout ) {
            window.clearTimeout( featDiv.contextMenuTimeout );
        }
        var timeToLive = 30000; // clean menus up after 30 seconds
        featDiv.contextMenuTimeout = window.setTimeout( function() {
                                                            if( featDiv.contextMenu ) {
                                                                featDiv.contextMenu.destroyRecursive();
                                                                delete featDiv.contextMenu;
                                                            }
                                                            delete featDiv.contextMenuTimeout;
                                                        }, timeToLive );
    },

    /**
     * Make the right-click dijit menu for a feature.
     */
    _makeFeatureContextMenu: function( featDiv, menuTemplate ) {
        // interpolate template strings in the menuTemplate
        menuTemplate = this._processMenuSpec(
            dojo.clone( menuTemplate ),
            featDiv
        );

        // render the menu, start it up, and bind it to right-clicks
        // both on the feature div and on the label div
        var menu = this._renderMenu( menuTemplate, featDiv );
        menu.startup();
        menu.bindDomNode( featDiv );
        if( featDiv.labelDiv )
            menu.bindDomNode( featDiv.labelDiv );

        return menu;
    },

    _processMenuSpec: function( spec, featDiv ) {
        for( var x in spec ) {
            if( typeof spec[x] == 'object' )
                spec[x] = this._processMenuSpec( spec[x], featDiv );
            else
                spec[x] = this.template( featDiv.feature, this._evalConf( featDiv, spec[x], x ) );
        }
        return spec;
    },

    /**
     * Get the value of a conf variable, evaluating it if it is a
     * function.  Note: does not template it, that is a separate step.
     *
     * @private
     */
    _evalConf: function( context, confVal, confKey ) {

        // list of conf vals that should not be run immediately on the
        // feature data if they are functions
        var dontRunImmediately = {
            action: 1,
            click: 1,
            content: 1
        };

        return typeof confVal == 'function' && !dontRunImmediately[confKey]
            ? confVal( this, context.feature, context )
            : confVal;
    },

    /**
     * Render a dijit menu from a specification object.
     *
     * @param menuTemplate definition of the menu's structure
     * @param context {Object} optional object containing the context
     *   in which any click handlers defined in the menu should be
     *   invoked, containing thing like what feature is being operated
     *   upon, the track object that is involved, etc.
     * @param parent {dijit.Menu|...} parent menu, if this is a submenu
     */
    _renderMenu: function( /**Object*/ menuStructure, /** Object */ context, /** dijit.Menu */ parent ) {
       if ( !parent )
            parent = new dijitMenu();

        for ( key in menuStructure ) {
            var spec = menuStructure [ key ];
            if ( spec.children ) {
                var child = new dijitMenu ();
                parent.addChild( child );
                parent.addChild( new dijitPopupMenuItem(
                                     {
                                         popup : child,
                                         label : spec.label
                                     }));
                this._renderMenu( spec.children, context, child );
            }
            // only draw other menu items if they have an action.
            // drawing menu items that do nothing when clicked
            // would frustrate users.
            else if( spec.action || spec.url || spec.href ) {
                var menuConf = dojo.clone( spec );
                menuConf.onClick = this._makeClickHandler( spec, context );
                var child = new dijitMenuItem( menuConf );
                parent.addChild(child);
            }
        }
        return parent;
    },

    _openDialog: function( spec, evt, context ) {
        context = context || {};
        var type = spec.action;
        type = type.replace(/Dialog/,'');
        var featureName = context.feature && (context.feature.get('name')||context.feature.get('id'));
        var dialogOpts = {
            "class": "feature-popup-dialog feature-popup-dialog-"+type,
            title: spec.title || spec.label || ( featureName ? featureName +' details' : "Details"),
            style: dojo.clone( spec.style || {} )
        };
        var dialog;

        // if dialog == xhr, open the link in a dialog
        // with the html from the URL just shoved in it
        if( type == 'xhr' || type == 'content' ) {
            if( type == 'xhr' )
                dialogOpts.href = spec.url;
            else
                dialogOpts.content = this._evalConf( context, spec.content, null );
            dialog = new dijitDialog( dialogOpts );
        }
        // open the link in a dialog with an iframe
        else if( type == 'iframe' ) {
            dojo.safeMixin( dialogOpts.style, {width: '90%', height: '90%'});
            dialogOpts.draggable = false;

            var container = dojo.create('div', {}, document.body);
            var iframe = dojo.create(
                'iframe', {
                    width: '100%', height: '100%',
                    tabindex: "0",
                    style: { border: 'none' },
                    src: spec.url
                }, container
            );
            dialog = new dijitDialog( dialogOpts, container );
            dojo.create( 'a', {
                             href: spec.url,
                             target: '_blank',
                             className: 'dialog-new-window',
                             title: 'open in new window',
                             onclick: dojo.hitch(dialog,'hide'),
                             innerHTML: spec.url
                         }, dialog.titleBar );
            aspect.after( dialog, 'layout', function() {
                              // hitch a ride on the dialog box's
                              // layout function, which is called on
                              // initial display, and when the window
                              // is resized, to keep the iframe
                              // sized to fit exactly in it.
                              var cDims = domGeom.getMarginBox( dialog.domNode );
                              iframe.width  = cDims.w;
                              iframe.height = iframe.height = cDims.h - domGeom.getMarginBox(dialog.titleBar).h - 2;
                          });
        }

        aspect.after( dialog, 'hide', function() { dialog.destroyRecursive(); });
        dialog.show();
    },

    _makeClickHandler: function( inputSpec, context ) {
        var track  = this;

        if( typeof inputSpec == 'function' ) {
            inputSpec = { action: inputSpec };
        }
        else if( typeof inputSpec == 'undefined' ) {
            console.error("Undefined click specification, cannot make click handler");
            return function() {};
        }

        var handler = function ( evt ) {
            if( track.genomeView.dragging )
                return;

            var ctx = context || this;
            var spec = track._processMenuSpec( dojo.clone( inputSpec ), ctx );
            var url = spec.url || spec.href;
            spec.url = url;
            var style = dojo.clone( spec.style || {} );

            // try to understand the `action` setting
            spec.action = spec.action ||
                ( url          ? 'iframeDialog'  :
                  spec.content ? 'contentDialog' :
                                 false
                );
            spec.title = spec.title || spec.label;

            if( typeof spec.action == 'string' ) {
                // treat `action` case-insensitively
                spec.action = {
                    iframedialog:   'iframeDialog',
                    iframe:         'iframeDialog',
                    contentdialog:  'contentDialog',
                    content:        'content',
                    xhrdialog:      'xhrDialog',
                    xhr:            'xhr',
                    newwindow:      'newWindow',
                    "_blank":       'newWindow'
                }[(''+spec.action).toLowerCase()];

                if( spec.action == 'newWindow' )
                    window.open( url, '_blank' );
                else if( spec.action in { iframeDialog:1, contentDialog:1, xhrDialog:1} )
                    track._openDialog( spec, evt, ctx );
            }
            else if( typeof spec.action == 'function' ) {
                spec.action.call( ctx, evt );
            }
            else {
                return;
            }
        };

        // if there is a label, set it on the handler so that it's
        // accessible for tooltips or whatever.
        if( inputSpec.label )
            handler.label = inputSpec.label;

        return handler;
    },

    /**
     * Given a string with template callouts, interpolate them with
     * data from the given object.  For example, "{foo}" is replaced
     * with whatever is returned by obj.get('foo')
     */
    template: function( /** Object */ obj, /** String */ template ) {
        if( typeof template != 'string' || !obj )
            return template;

        var valid = true;
        if ( template ) {
            return template.replace(
                    /\{([^}]+)\}/g,
                    function(match, group) {
                        var val = obj.get( group.toLowerCase() );
                        if (val !== undefined)
                            return val;
                        else {
                            return '';
                        }
                    });
        }
        return undefined;
    },

    renderSubfeature: function(feature, featDiv, subfeature, displayStart, displayEnd) {
        var subStart = subfeature.get('start');
        var subEnd = subfeature.get('end');
        var featLength = displayEnd - displayStart;

        var subDiv = document.createElement("div");

        var type = subfeature.get('type');
        subDiv.className = (this.config.style.subfeatureClasses||{})[type] || this.config.style.className + '-' + type;
        switch ( subfeature.get('strand') ) {
        case 1:
        case '+':
            subDiv.className += " plus-" + subDiv.className; break;
        case -1:
        case '-':
            subDiv.className += " minus-" + subDiv.className; break;
        }

        // if the feature has been truncated to where it doesn't cover
        // this subfeature anymore, just skip this subfeature
        if ((subEnd <= displayStart) || (subStart >= displayEnd)) return;

        if (Util.is_ie6) subDiv.appendChild(document.createComment());

        // NOTE: subfeatures are hidden until they are centered by
        // _centerFeatureElements, so that they don't jump around
        // on the screen
        subDiv.style.cssText =
            "visibility: hidden; left: " + (100 * ((subStart - displayStart) / featLength)) + "%;"
            + "top: 0px;"
            + "width: " + (100 * ((subEnd - subStart) / featLength)) + "%;";
        featDiv.appendChild(subDiv);
    }
});

/**
 * Mixin: JBrowse.View.Track.YScaleMixin.
 */
dojo.extend( HTMLFeatures, YScaleMixin );

return HTMLFeatures;
});

/*

Copyright (c) 2007-2010 The Evolutionary Software Foundation

Created by Mitchell Skinner <mitch_skinner@berkeley.edu>

This package and its accompanying libraries are free software; you can
redistribute it and/or modify it under the terms of the LGPL (either
version 2.1, or at your option, any later version) or the Artistic
License 2.0.  Refer to LICENSE for the full license text.

*/
