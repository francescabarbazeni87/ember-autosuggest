var get = Ember.get,
    set = Ember.set,
    setEach = Ember.setEach,
    addObserver = Ember.addObserver,
    removeObserver = Ember.removeObserver;

window.AutoSuggestComponent = Ember.Component.extend({
  classNameBindings: [':autosuggest'],
  minChars: 1,
  searchPath: 'name',
  query: null,
  selectionIndex: -1,

  init: function(){
    this._super.apply(this, arguments);
    addObserver(this, 'query', this.queryDidChange);
    set(this, 'displayResults', Ember.A());
  },

  didInsertElement: function(){
    Ember.assert('You must supply a source for the autosuggest component', get(this, 'source'));
    Ember.assert('You must supply a destination for the autosuggest component', get(this, 'destination'));

    this.$('ul.suggestions').on('mouseover', this.mouseOver.bind(this));
    this.$('ul.suggestions').on('mouseout', this.mouseOut.bind(this));
  },

  _source: Ember.computed(function(){
    var source = get(this, 'source');

    return Ember.RSVP.Promise(function(resolve, reject){
      if(!source.then){
        resolve(source);
      }else{
        source.then(resolve, reject);
      }
    });
  }).property('source'),

  queryDidChange: function(){
    var query = get(this, 'query'),
        source = get(this, '_source'),
        displayResults = get(this, 'displayResults'),
        self = this;

    if((!query) || (query.length <= get(this, 'minChars'))){
      set(this, 'selectionIndex', -1);
      return displayResults.clear();
    }

    source.then(function(results){
      self.processResults(query, results);
    },
    function(e){
      console.log(e.message);
      console.log(e.stack);
    });
  },

  processResults: function(query, source){
    var self = this,
        displayResults = get(this, 'displayResults');

    this.positionResults();

    var results = source.filter(function(item){
      return item.get(get(self, 'searchPath')).toLowerCase().search(query.toLowerCase()) !== -1;
    }).filter(function(item){
      return !get(self, 'destination').contains(item);
    });

    if(get(results, 'length') === 0){
      return displayResults.clear();
    }

    var searchPath = get(this, 'searchPath');

    displayResults.clear();

    displayResults.pushObjects(Ember.A(results.sort(function(a, b){
      return Ember.compare(get(a, searchPath), get(b, searchPath));
    })));
  },

  hideResults: function(){
    var displayResults = get(this, 'displayResults');

    set(this, 'selectionIndex', -1);

    if(!get(displayResults, 'length')){
      this.$('.no-results').addClass('hdn');
      return;
    }

    this.$('.results').addClass('hdn');
  },

  addSelection: function(selection){
    set(this, 'query', '');
    get(this, 'destination').addObject(selection);
    set(this, 'selectionIndex', -1);
  },

  hasQuery: Ember.computed(function(){
    var query = get(this, 'query');

    if(query && query.length > get(this, 'minChars')){
      this.positionResults();
      return true;
    }

    return false;
  }).property('query'),

  removeSelection: function(item){
    get(this, 'destination').removeObject(item);
  },


  moveSelection: function(direction){
    var selectionIndex = get(this, 'selectionIndex'),
        isUp = direction === 'up',
        isDown = !isUp,
        displayResults = get(this, 'displayResults'),
        displayResultsLength = get(displayResults, 'length'),
        searchPath = get(this, 'searchPath'),
        hoverEl;

    displayResults.setEach('active', false); 

    if(!displayResultsLength){
      set(this, 'selectionIndex', -1);
      return;
    }

    hoverEl = this.$('li.result.hover');

    if(hoverEl.length){
      var text = Ember.$('span', hoverEl).text(),
          selected = displayResults.find(function(item){
                        return get(item, searchPath) === text;
                     });

      selectionIndex = displayResults.indexOf(selected);

      this.$('ul.suggestions li').removeClass('hover');

      this.$('input.autosuggest').focus();
    }

    if(isUp && selectionIndex <= 0){
      selectionIndex =  0;
    }
    else if(isDown && selectionIndex === displayResultsLength -1){
      selectionIndex = displayResultsLength -1;
    }else if(isDown){
      selectionIndex++;
    }else{
      selectionIndex--;
    }

    var active = get(this, 'displayResults').objectAt(selectionIndex);

    set(this, 'selectionIndex', selectionIndex);

    set(active, 'active', true);
  },

  selectActive: function(){
    var selectionIndex = get(this, 'selectionIndex'),
        displayResultsLength = get(this, 'displayResults.length');

    if(!displayResultsLength){
      return;
    }

    var active = get(this, 'displayResults').find(function(item){
      return get(item, 'active');
    });

    if(!active){
      return;
    }

    this.addSelection(active);
  },

  mouseOver: function(evt){
    var el = this.$(evt.target);

    if(evt.target.tagName.toLowerCase() !== 'ul' && !el.hasClass('result')){
      return;
    }

    var active = get(this, 'displayResults').filter(function(item){
                   return get(item, 'active');
                 });

    if(active || active.length){
      active.setEach('active', false);
      set(this, 'selectionIndex', -1);
    }

    this.$('ul.suggestions li').removeClass('hover');

    el.addClass('hover');
  },

  mouseOut: function(evt){
    this.$('ul.suggestions li').removeClass('hover');
  },

  positionResults: function(){
    var results = this.$('.results');

    var input = this.$('input.autosuggest'),
        suggestions = this.$('ul.suggestions'),
        selections = this.$('ul.selections'),
        position = input.position();

    results.removeClass('hdn');

    suggestions.css('position', 'absolute');
    suggestions.css('left', position.left);
    suggestions.css('top', position.top + input.height() + 7);
    suggestions.css('width', this.$('ul.selections').outerWidth() - position.left);
  },

  autosuggest: Ember.TextField.extend({
    KEY_DOWN: 40,
    KEY_UP: 38,
    COMMA: 188,
    TAB: 9,
    ENTER: 13,
    ESCAPE: 27,

    init: function(){
      this._super.apply(this, arguments);
      this.set('allowedKeyCodes', [this.KEY_UP, this.KEY_DOWN, this.COMMA, this.TAB, this.ENTER, this.ESCAPE]);
    },

    keyDown: function(e){
      var keyCode = e.keyCode;

      if(!this.get('allowedKeyCodes').contains(keyCode)){
        return;
      }

      var controller = get(this, 'controller');

      switch(keyCode){
        case this.KEY_UP:
          controller.moveSelection('up');
          break;
        case this.KEY_DOWN:
          controller.moveSelection('down');
          break;
        case this.ENTER:
          controller.selectActive(); 
          break;
        case this.ESCAPE:
          controller.hideResults();
          break;
        default:
          console.log(keyCode);
      }
    },
  }),
});
