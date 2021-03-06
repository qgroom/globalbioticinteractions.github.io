var fs = require('fs');
var insertCss = require('insert-css');
var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var d3 = require('d3');
var taxaprisma = require('taxaprisma');
var transform = require('./lib/transform.js');

inherits(Bundle, EventEmitter);
module.exports = Bundle;

var translate = [0, 0];
var scale = 1;


function Bundle(settings) {
    var me = this;
    if (!(this instanceof Bundle)) return new Bundle(settings);
    this.settings = settings;

    if (me.settings.searchContext) {
        me.searchContext = me.settings.searchContext;
        delete me.settings.searchContext;
    }

    if (me.searchContext) {
        me.searchContext.on('globisearch:resultsetchanged', function(json) {
            me.settings.json = json;
            me.draw();
        });
    }
}

Bundle.prototype.appendTo = function (target) {
    if (typeof target === 'string') target = document.querySelector(target);
    this.settings.target = target;
    var css = fs.readFileSync(__dirname + '/style.css', 'utf8');
    insertCss(css);
    if (this.settings.json && this.settings.json.length > 0) {
        this.draw();
    }
    this.emit('append', this.settings.target);
};

Bundle.prototype.draw = function() {
    this.settings.target.innerHTML ='';
    this._buildBundles()
};

Bundle.prototype._buildBundles = function() {
    var me = this;
    var target = this.settings.target,
        json = this.settings.json,
        canvasDimension = this.settings.canvasDimension;
    if (json.length === 0) return;
    var radius = (canvasDimension.height < canvasDimension.width) ? canvasDimension.height : canvasDimension.width,
        innerRadius = radius - 150;

    var cluster = d3.layout.cluster()
        .size([360, innerRadius])
        .sort(function (a, b) {
            return d3.ascending(a.key, b.key);
        })
        .value(function (d) {
            return d.size;
        });

    var bundle = d3.layout.bundle();

    var line = d3.svg.line.radial()
        .interpolate("bundle")
        .tension(0.85)
        .radius(function (d) {
            return d.y;
        })
        .angle(function (d) {
            return d.x / 180 * Math.PI;
        });

    var svg = d3.select(target).append("svg")
        .attr('width', canvasDimension.width * 2)
        .attr('height', canvasDimension.height * 2)
        .attr('viewBox', '0 0 ' + canvasDimension.width * 2 + ' ' + canvasDimension.height * 2)
        .attr('zoomAndPan', 'magnify')
        .call(d3.behavior.zoom().on('zoom', function(evt) {
            translate = d3.event.translate;
            scale = d3.event.scale;
            svg.attr('transform', 'translate(' + translate + ')' + ' scale(' + scale + ')');
        }))
        .append("g")
        .attr("transform", "translate(" + radius + "," + 0.97 * radius + ")");

    var link = svg.append("g").selectAll(".bundl-link"),
        node = svg.append("g").selectAll(".bundl-node");


    var classes = transform.parseToStructure(json);

    var nodes = cluster.nodes(transform.taxonHierarchy(classes));
    var links = transform.taxonPreys(nodes);
    link = link
        .data(bundle(links))
        .enter().append("path")
        .each(function (d) {
            d.source = d[0], d.target = d[d.length - 1];
        })
        .attr("class", "bundl-link")
        .attr("d", line);

    node = node
        .data(nodes.filter(function (n) {
            return !n.children;
        }))
        .enter().append("text")
        .attr("class", "bundle-node")
        .attr("dx", function (d) {
            return d.x < 180 ? 8 : -8;
        })
        .attr("dy", ".31em")
        .attr("transform", function (d) {
            return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")" + (d.x < 180 ? "" : "rotate(180)");
        })
        .style("text-anchor", function (d) {
            return d.x < 180 ? "start" : "end";
        })
        .style("cursor", "pointer")
        .style("fill", function(d) { return taxaprisma.colorFor(d.path); } )
        .text(function (d) {
            return d.key.length > 20 ? d.key.substring(0, 19) + '...' : d.key;
        })
        .on('click', function (d) {
            me.emit('select', taxonEvent(d));
        })
        .on("mouseover", mouseovered)
        .on("mouseout", mouseouted)
        .append("title").text(function (d) {
            return d.path.replace(/\./g, ' | ');
        })
    ;

    function taxonEvent(node) {
        var taxon = transform.toTaxon(node);
        taxon.x = d3.event.pageX;
        taxon.y = d3.event.pageY;
        return taxon;
    }

    function mouseovered(d) {
        node
            .each(function (n) {
                n.target = n.source = false;
            });

        link
            .classed("link--target", function (l) {
                return l.target === d;
            })
            .classed("link--source", function (l) {
                return l.source === d;
            })
            .filter(function (l) {
                return l.target === d || l.source === d;
            })
            .each(function () {
                this.parentNode.appendChild(this);
            });

        node
            .classed("node--target", function (n) {
                return n.target;
            })
            .classed("node--source", function (n) {
                return n.source;
            });
    }

    function mouseouted(d) {
        me.emit('deselect', taxonEvent(d));
        link
            .classed("link--target", false)
            .classed("link--source", false);

        node
            .classed("node--target", false)
            .classed("node--source", false);
    }

};