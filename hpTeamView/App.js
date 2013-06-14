Ext.define('CustomApp', {
    extend: 'Rally.app.TimeboxScopedApp',
    scopeType: 'release',

    addContent: function (scope) {
        this.callParent(arguments);

        Rally.data.ModelFactory.getModels({
            types: ['Defect', 'User Story'],
            scope: this,
            success: function (models) {
                this.models = models;

                this.loadData(scope);
            }
        });

        this.subscribe(Rally.Message.objectUpdate, function (records) {
            this.resetMe(this.getContext().getTimeboxScope());
        }, this);
    },

    onScopeChange: function (scope) {
        this.callParent(arguments)
        this.resetMe(scope);

    },

    resetMe: function (scope) {
        this.removeAll();
        this.loadData(scope);
    },

    loadData: function (scope) {
        this.loadArtifactRecords(this.models['User Story'], scope, function (userStoryStore, userStoryRecords) {
            this.loadArtifactRecords(this.models.Defect, scope, function (defectStore, defectRecords) {
                this.recordsLoaded(userStoryRecords.concat(defectRecords));
            });
        });
    },

    loadArtifactRecords: function (model, scope, onLoad) {
        Ext.create('Rally.data.WsapiDataStore', {
            autoLoad: true,
            model: model,
            filters: [
                {
                    property: 'c_SWPWorkflowDependencies',
                    operator: '!=',
                    value: ''
                },
                {
                    property: this.scopeType,
                    operator: '=',
                    value: scope.record.getRef().getUri()
                }
            ],
            listeners: {
                load: onLoad,
                scope: this
            }
        });
    },

    recordsLoaded: function (records) {
        if (records.length > 0) {
            var workflowDependencies = [];
            Ext.Array.each(records, function (record) {
                workflowDependencies = workflowDependencies.concat(record.get('c_SWPWorkflowDependencies').split(','));
            });
            workflowDependencies = Ext.Array.unique(workflowDependencies);

            var filters = [];
            Ext.Array.each(workflowDependencies, function (record) {
                filters.push({
                    property: 'FormattedID',
                    operator: '=',
                    value: record
                });
            });

            this.add({
                xtype: 'rallygrid',
                model: this.models['User Story'],
                columnCfgs: [
                    'FormattedID',
                    'Name',
                    'Owner',
                    'Project',
                    'ScheduleState',
                    'Tags'
                ],
                storeConfig: {
                    context: {
                        project: null
                    },
                    filters: [Rally.data.QueryFilter.or(filters)],
                    sorters: [
                        {
                            property: 'Project',
                            order: 'ASC'
                        }
                    ]
                }
            });
        }
    }

});