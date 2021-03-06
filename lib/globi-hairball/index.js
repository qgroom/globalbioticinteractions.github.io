var fs = require('fs');
var insertCss = require('insert-css');
var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var d3 = require('d3');
var transform = require('./lib/transform.js');
var taxaprisma = require('taxaprisma');

inherits(Hairball, EventEmitter);
module.exports = Hairball;


d3.selection.prototype.moveToFront = function () {
    return this.each(function () {
        this.parentNode.appendChild(this);
    });
};

var config = {
    dimensions: {
        width: 600,
        height: 300
    },
    arrow: {
        width: 3,
        length: 7
    }
};
var translate = [0, 0];
var scale = 1;
var force;
var chart;
var link;
var node;

function Hairball(settings) {
    var me = this;
    if (!(this instanceof Hairball)) return new Hairball(settings);
    this.settings = settings;

    if (me.settings.searchContext) {
        me.searchContext = me.settings.searchContext;
        delete me.settings.searchContext;
    }

    if (me.searchContext) {
        me.searchContext.on('globisearch:resultsetchanged', function (json) {
            me.settings.json = json;
            me.draw();
        });
    }

}

Hairball.prototype.appendTo = function (target) {
    if (typeof target === 'string') target = document.querySelector(target);
    this.settings.target = target;
    var css = fs.readFileSync(__dirname + '/style.css', 'utf8');
    insertCss(css);
    if (this.settings.json && this.settings.json.length > 0) {
        this.draw();
    }
    this.emit('append', target);
};


Hairball.prototype.draw = function () {
    this.settings.target.innerHTML = '';
    this.initGraph();
};


Hairball.prototype.initGraph = function () {
    var target = this.settings.target,
        data = this.settings.json,
        canvasDimension = this.settings.canvasDimension;
    var me = this;
    if (data.length === 0) return;
    config.dimensions.width = canvasDimension.width;
    config.dimensions.height = canvasDimension.height;

    force = d3.layout.force()
        .gravity(.07)
        .distance(20)
        .charge(-200)
        .linkDistance(60)
        .linkStrength(.3)
        .size([config.dimensions.width, config.dimensions.height])
        .on('tick', tick);

    chart = d3.select(target).append('svg:svg')
        .attr('width', config.dimensions.width * 2)
        .attr('height', config.dimensions.height * 2)
        .attr('pointer-events', 'all')
        .call(d3.behavior.zoom().on('zoom', redraw))
        .append('svg:g');

    var defs = chart.append('svg:defs');
    defs.append('svg:marker')
        .attr('id', 'arrowGray')
        .attr('viewBox', '0 0 ' + config.arrow.length + ' ' + config.arrow.width)
        .attr('refX', config.arrow.length)
        .attr('refY', config.arrow.width / 2)
        .attr('markerUnits', 'userSpaceOnUse')
        .attr('markerWidth', config.arrow.length + 2)
        .attr('markerHeight', config.arrow.width + 2)
        .attr('orient', 'auto')
        .append('svg:path')
        .attr('d', 'M 0 0 L ' + config.arrow.length + ' ' + (config.arrow.width / 2) + ' L 0 ' + config.arrow.width + ' z')
        .style('fill', '#888');

    link = chart.selectAll('.link');
    node = chart.selectAll('.node');

    var linksAndNodes = transform.parseInteractions(data);

    this.update(linksAndNodes.links, linksAndNodes.nodes);
}

Hairball.prototype.update = function (links, nodes) {
    var me = this;
    force
        .nodes(nodes)
        .links(links)
        .start();

    link = link.data(links);

    link.exit().remove();

    link.enter().insert('line', '.node')
        .attr('class', 'hairball-link')
        .attr('data-source-id', function (d) {
            return d.source.id;
        })
        .attr('data-target-id', function (d) {
            return d.target.id;
        })
        .attr('marker-end', 'url(#arrowGray)')
        .attr('link_id', function (d) {
            return d['link_id'];
        });

    node = node.data(nodes);

    node.exit().remove();

    function taxonEvent(node) {
        var taxon = transform.toTaxon(node);
        taxon.x = d3.event.pageX;
        taxon.y = d3.event.pageY;
        return taxon;
    }

    var highlightSelected = function (node) {
        dimSelected(node);

        var $this = d3.selectAll('[eolid=' + node.id + ']');
        var selectedLinks = d3.selectAll('[data-source-id=' + node.id + '], [data-target-id=' + node.id + ']');;

        if (selectedLinks[0].length > 0) {
            selectedLinks.classed('deselected', false).classed('selected', true);
            selectedLinks[0].forEach(function (link) {
                if (link.dataset) {
                    var selectedNodes = d3.selectAll('[eolid=\"' + link.dataset['sourceId'] + '\"], [eolid=\"' + link.dataset['targetId'] + '\"]');
                    selectedNodes.classed('deselected', false).classed('selected', true);
                    selectedNodes.moveToFront();
                }
            });
        }
        $this.moveToFront();
    };

    var dimSelected = function (node) {
        var allNodesAndLinks = d3.selectAll('.hairball-node, .hairball-link');
        allNodesAndLinks.classed('deselected', true).classed('selected', false);
    };


    var nodeEnter = node.enter().append('g')
        .attr('class', 'hairball-node')
        .attr('eolid', function (d) {
            return d['id']
        })
        .on('touchstart', function () {
            d3.event.stopPropagation();
        })
        .on('mousedown', function () {
            d3.event.stopPropagation();
        })
        .on('click', function (d) {
            me.emit('select', taxonEvent(d));
        })
        .on('mouseover', highlightSelected)
        .call(force.drag);

    nodeEnter.append('circle')
        .style('fill', function (d) {
            return taxaprisma.colorFor(d.path);
        })
        .attr('r', 3);

    nodeEnter.append('text')
        .attr('dy', '.35em')
        .attr('dx', '.35em')
        .text(function (d) {
            return d['name'];
        }).attr('shown', false);
}

function tick() {
    link.attr('x1', function (d) {
        return d.source.x;
    })
        .attr('y1', function (d) {
            return d.source.y;
        })
        .attr('x2', function (d) {
            return d.target.x;
        })
        .attr('y2', function (d) {
            return d.target.y;
        });

    node.attr('transform', function (d) {
        return 'translate(' + d.x + ',' + d.y + ')';
    });
}

function redraw() {
    translate = d3.event.translate;
    scale = d3.event.scale;
    chart.attr('transform', 'translate(' + translate + ')' + ' scale(' + scale + ')');
}