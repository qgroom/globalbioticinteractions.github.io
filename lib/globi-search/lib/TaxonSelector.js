var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var DataParser = require('./DataParser.js');
var extend = require('extend');
var forEach = require('foreach');
var jQuery = require('jquery');

require('./jquery.tokeninput');

inherits(TaxonSelector, EventEmitter);

function TaxonSelector(settings) {
    var me = this;
    this.settings = extend({
        search: null,
        idPrefix: '',
        splashText: 'Data load ... please wait.',
        placeholder: 'Taxon ...',
        hintText: 'Type in a taxon name',
        type: 'taxon',
        url: 'https://api.globalbioticinteractions.org/findCloseMatches',
        queryParam: 'taxonName',
        preSelectedTaxa: [],
        selected: {
            callback: function() {
                if (arguments.length > 0) {
                    settings.searchContext.emit('taxonselector:selected', arguments[0]);
                }
            },
            context: this
        }
    }, settings);
    this.init();
}

extend(TaxonSelector.prototype, {
    init: function() {
        var me = this;
        me.el = createElement('div', me.settings['idPrefix'] + '-selector-wrapper');

        me.data = [];
        me.input = null;
        me.events();

        me.emit('taxonselector:init');
    },

    events: function() {
        var me = this;
        me.on('taxonselector:init', me.process);
        me.on('taxonselector:process', me.render);
        me.on('taxonselector:update', me.process);
    },

    update: function(search) {
        this.settings['search'] = search;
        this.emit('taxonselector:update');
    },

    process: function() {
        var me = this;
        me.el.innerHTML = '';

        me.input = createElement('input', me.settings['idPrefix'] + '-input');
        me.input.setAttribute('placeholder', me.settings['placeholder']);

        var inputWrapper = createElement('div', false, ['input-wrapper']);
        inputWrapper.appendChild(me.input);

        me.el.appendChild(inputWrapper);

        var wrapper = createElement('div', false, ['wrapper']);
        wrapper.appendChild(createElement('div', me.settings['idPrefix'] + '-id', ['id-field']));
        wrapper.appendChild(createElement('div', me.settings['idPrefix'] + '-name', ['name-field']));

        me.el.appendChild(wrapper);
        me.el.appendChild(createElement('div', false, ['clearer']));

        me.emit('taxonselector:process');
    },

    clear: function() {
        var me = this.input;
        var tokens = jQuery(this.input).tokenInput("get");
        tokens.forEach(function(token) {
            token.removeQuietly = true;
            jQuery(me).tokenInput("remove", token);
        });
    },

    add: function(taxonName) {
        jQuery(this.input).tokenInput("add", { id: 1, label: taxonName, addQuietly: true});
    },

    render: function() {
        var me = this,
            settings = me.settings;

        var prePopulated = me.settings.preSelectedTaxa.map(function(taxon, index) {
            return { id: index, label: taxon };
        });

        var onNameSelected = function(name) {
          setTimeout(settings['selected'].callback.call(settings['selected'].context, { emitter: settings['type'], data: name } ), 0);
        };

        jQuery(this.input).tokenInput(settings['url'],{
            queryParam: settings['queryParam'],
            crossDomain: false,
            onResult: function(results) {
                return DataParser.process(results);
            },
            placeholder: settings['placeholder'],
            hintText: settings['hintText'],
            propertyToSearch: 'label',
            preventDuplicates: true,
            prePopulate: prePopulated,
            tokenValue: 'value',
            tokenLimit: 1,
            allowFreeTagging: true,
            onFreeTaggingAdd: function(hiddenInput, token) {
              return hiddenInput;
            },
            onAdd: function(item) {
                if (!item.addQuietly) {
                    onNameSelected(item.name || item.value);
                }
            },
            onDelete: function(item) {
                if (!item.removeQuietly) {
                    onNameSelected(null);
                }
            }
        });
    }
});

/**
 * @param elementName
 * @param id
 * @param classes
 * @returns {Element}
 */
function createElement(elementName, id, classes) {
    elementName = elementName || 'div';
    id = id || false;
    classes = classes || [];

    var div = document.createElement(elementName);
    if (id) div.id = id;
    if (classes.length > 0 ) div.className = classes.join(' ');
    return div;
}

module.exports = TaxonSelector;

