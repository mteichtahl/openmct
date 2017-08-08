define(
    [
        'text!../res/ruleTemplate.html',
        './Condition',
        './input/ColorPalette',
        './input/IconPalette',
        'lodash',
        'zepto'
    ],
    function (
        ruleTemplate,
        Condition,
        ColorPalette,
        IconPalette,
        _,
        $
    ) {

    // a module representing a summary widget rule. Maintains a set of text
    // and css properties for output, and a set of conditions for configuring
    // when the rule will be applied to the summary widget.
    // parameters:
    // ruleConfig: a JavaScript representing the configuration of this rule
    // domainObject: the Summary Widget domain object
    // openmct: an MCT instance
    // conditionManager: a ConditionManager instance
    function Rule(ruleConfig, domainObject, openmct, conditionManager) {
        var self = this;

        this.config = ruleConfig;
        this.domainObject = domainObject;
        this.openmct = openmct;
        this.conditionManager = conditionManager;

        this.domElement = $(ruleTemplate);
        this.conditions = [];

        this.remove = this.remove.bind(this);
        this.duplicate = this.duplicate.bind(this);
        this.addCondition = this.addCondition.bind(this);
        this.initCondition = this.initCondition.bind(this);
        this.removeCondition = this.removeCondition.bind(this);
        this.refreshConditions = this.refreshConditions.bind(this);
        this.onConditionChange = this.onConditionChange.bind(this);

        this.thumbnail = $('.t-widget-thumb', this.domElement);
        this.title = $('.rule-title', this.domElement);
        this.description = $('.rule-description', this.domElement);
        this.trigger = $('.t-trigger', this.domElement);
        this.toggleConfigButton = $('.view-control', this.domElement);
        this.configArea = $('.widget-rule-content', this.domElement);
        this.grippy = $('.t-grippy', this.domElement);
        this.conditionArea = $('.t-widget-rule-config', this.domElement);
        this.deleteButton = $('.t-delete', this.domElement);
        this.duplicateButton = $('.t-duplicate', this.domElement);
        this.addConditionButton = $('.add-condition', this.domElement);

        this.textInputs = {
            name: $('.t-rule-name-input', this.domElement),
            label: $('.t-rule-label-input', this.domElement),
            message: $('.t-rule-message-input', this.domElement)
        };

        this.iconInput = new IconPalette('icon', '');

        this.colorInputs = {
            'background-color': new ColorPalette('background-color', 'icon-paint-bucket'),
            'border-color': new ColorPalette('border-color', 'icon-line-horz'),
            'color': new ColorPalette('color', 'icon-T')
        };

        this.callbacks = {
            remove: [],
            duplicate: [],
            change: []
        };

        function onIconInput(icon) {
            self.config.icon = icon;
            self.updateDomainObject('icon', icon);
            self.callbacks.change.forEach( function (callback) {
                if (callback) {
                    callback();
                }
            });
        }

        function onColorInput(color, property) {
            self.config.style[property] = color;
            self.updateDomainObject('style.' + property, color);
            self.thumbnail.css(property, color);
            self.callbacks.change.forEach( function (callback) {
                if (callback) {
                    callback();
                }
            });
        }

        function onTriggerInput(event) {
            var elem = event.target;
            self.config.trigger = elem.value;
            self.updateDomainObject('trigger', elem.value);
            self.callbacks.change.forEach( function (callback) {
                if (callback) {
                    callback();
                }
            });
        }

        function toggleConfig() {
            self.configArea.toggleClass('expanded');
            self.toggleConfigButton.toggleClass('expanded');
            self.config.expanded = !self.config.expanded;
        }

        function onTextInput(elem, inputKey) {
              self.config[inputKey] = elem.value;
              self.updateDomainObject(inputKey, elem.value);
              if (inputKey === 'name') {
                  self.title.html(elem.value);
              }
              self.callbacks.change.forEach( function (callback) {
                  if (callback) {
                      callback();
                  }
              });
        }

        $('.t-rule-label-input', this.domElement).before(this.iconInput.getDOM());
        this.iconInput.set(self.config.icon);
        this.iconInput.on('change', onIconInput);

        Object.keys(this.colorInputs).forEach( function (inputKey) {
            var input = self.colorInputs[inputKey];
            input.on('change', onColorInput);
            input.set(self.config.style[inputKey]);
            $('.t-style-input', self.domElement).append(input.getDOM());
        });

        Object.keys(this.textInputs).forEach( function (inputKey) {
            self.textInputs[inputKey].prop('value', self.config[inputKey]);
            self.textInputs[inputKey].on('input', function (){
                onTextInput(this, inputKey);
            });
        });

        this.deleteButton.on('click', this.remove);
        this.duplicateButton.on('click', this.duplicate);
        this.addConditionButton.on('click', this.addCondition);
        this.toggleConfigButton.on('click', toggleConfig);
        this.trigger.on('change', onTriggerInput);

        this.title.html(self.config.name);
        this.description.html(self.config.description);
        this.trigger.prop('value', self.config.trigger);

        if (!this.conditionManager.loadCompleted()) {
            this.config.expanded = false;
        }

        if (!this.config.expanded) {
            this.configArea.removeClass('expanded');
            this.toggleConfigButton.removeClass('expanded');
        }

        this.refreshConditions();

        //if this is the default rule, hide elements that don't apply
        if (this.config.id === 'default') {
            $('.t-delete', this.domElement).hide();
            $('.t-widget-rule-config', this.domElement).hide();
            $('.t-grippy', this.domElement).hide();
        }
    }

    Rule.prototype.getDOM = function () {
        return this.domElement;
    };

    Rule.prototype.on = function (event, callback) {
        if(this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    };

    Rule.prototype.onConditionChange = function(value, property, index) {
        _.set(this.config.conditions[index], property, value);
        this.updateDomainObject('conditions[' + index + '].' + property, value);
        this.callbacks.change.forEach( function (callback) {
            if (callback) {
                callback();
            }
        });
    };

    Rule.prototype.updateDomainObject = function (property, value) {
        this.openmct.objects.mutate(this.domainObject, 'configuration.ruleConfigById.' +
            this.config.id + '.' + property, value);
    };

    Rule.prototype.getProperty = function (prop) {
        return this.config[prop];
    };

    Rule.prototype.remove = function () {
        var ruleOrder = this.domainObject.configuration.ruleOrder,
            ruleConfigById = this.domainObject.configuration.ruleConfigById,
            self = this;

        ruleConfigById[self.config.id] = undefined;
        _.remove(ruleOrder, function (ruleId) {
            return ruleId === self.config.id;
        });
        self.openmct.objects.mutate(this.domainObject, 'configuration.ruleConfigById', ruleConfigById);
        self.openmct.objects.mutate(this.domainObject, 'configuration.ruleOrder', ruleOrder);

        self.callbacks.remove.forEach( function (callback) {
            if (callback) {
                callback();
            }
        });
    };

    //makes a deep copy of this rule's configuration, and calls the duplicate event
    //callback with the copy as an argument if one has been registered
    Rule.prototype.duplicate = function () {
        var sourceRule = JSON.parse(JSON.stringify(this.config)),
            self = this;
        sourceRule.expanded = true;
        self.callbacks.duplicate.forEach( function (callback) {
            if (callback) {
                callback(sourceRule);
            }
        });
    };

    Rule.prototype.addCondition = function () {
        this.initCondition();
    };

    Rule.prototype.initCondition = function (sourceConfig, sourceIndex) {
        var ruleConfigById = this.domainObject.configuration.ruleConfigById,
            newConfig,
            defaultConfig = {
                object: '',
                key: '',
                operation: '',
                values: []
            };

        newConfig = sourceConfig || defaultConfig;
        if (sourceIndex !== undefined) {
            ruleConfigById[this.config.id].conditions.splice(sourceIndex + 1, 0, newConfig);
        } else {
            ruleConfigById[this.config.id].conditions.push(newConfig);
        }
        this.openmct.objects.mutate(this.domainObject, 'configuration.ruleConfigById', ruleConfigById);
        this.refreshConditions();
    };

    Rule.prototype.refreshConditions = function () {
        var self = this;

        self.conditions = [];
        $('.t-condition', this.domElement).remove();

        this.config.conditions.forEach( function (condition, index) {
            var newCondition = new Condition(condition, index, self.conditionManager);
            newCondition.on('remove', self.removeCondition);
            newCondition.on('duplicate', self.initCondition);
            newCondition.on('change', self.onConditionChange);
            self.conditions.push(newCondition);
        });

        self.conditions.forEach( function (condition) {
            $('li:last-of-type', self.conditionArea).before(condition.getDOM());
        });

        if (self.conditions.length === 1) {
            self.conditions[0].hideButtons();
        }
    };

    Rule.prototype.removeCondition = function (removeIndex) {
      var ruleConfigById = this.domainObject.configuration.ruleConfigById,
          conditions = ruleConfigById[this.config.id].conditions,
          conditionLabels = ruleConfigById[this.config.id].conditionLabels;

      _.remove(conditions, function (condition, index) {
          return index === removeIndex;
      });
      _.remove(conditionLabels, function (condition, index) {
          return index === removeIndex;
      });

      this.openmct.objects.mutate(this.domainObject, 'configuration.ruleConfigById', ruleConfigById);
      this.refreshConditions();
    };

    return Rule;
});