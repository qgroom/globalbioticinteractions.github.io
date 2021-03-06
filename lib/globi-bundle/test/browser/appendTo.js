var GloBIBundle = require('globi-bundle');
var test = require('tape');

var EventEmitter = require('events').EventEmitter;
var PubSub = new EventEmitter();


test('check append bundle to body single interaction', function (t) {
    t.plan(4);
    t.notOk(document.querySelector(".bundle-node"));
    var data = [
        { source: { name: "taxon1", path: "taxonpath1", id: "id1" },
            type: 'preysOn',
            target: { name: 'taxon1', path: 'taxonpath1', id: 'id2'}}
    ];

    var w = GloBIBundle({ json: data, canvasDimension: { height: 123, width: 1234}});
    t.equal(w.settings.canvasDimension.height, 123);
    w.on('append', function (target) {
        t.equal(target, document.body);
        t.ok(document.querySelector(".bundle-node"));
    });
    w.appendTo(document.body);
});

test('check append bundle to body no data', function (t) {
    t.plan(2);
    var w = GloBIBundle({ json: [], canvasDimension: { height: 123, width: 1234}});
    t.equal(w.settings.canvasDimension.height, 123);
    w.on('append', function (target) {
        t.equal(target, document.body);
    });
    w.appendTo(document.body);
});

test('check append bundle to body no data then update with data', function (t) {
    t.plan(4);
    var w = GloBIBundle({ searchContext: PubSub, json: [], canvasDimension: { height: 123, width: 1234}});
    t.equal(w.settings.canvasDimension.height, 123);
    w.on('append', function (target) {
        t.ok('added to target:' + target);
    });
    var target = document.createElement('div');
    target.setAttribute('id', 'testing123');
    w.appendTo(target);

    t.notOk(target.querySelector(".bundle-node"));

    var data = [
        { source: { name: "taxon1", path: "taxonpath1", id: "id1" },
            type: 'preysOn',
            target: { name: 'taxon1', path: 'taxonpath1', id: 'id2'}}
    ];
    PubSub.emit('globisearch:resultsetchanged', data);

    t.ok(target.querySelector(".bundle-node"));
});
