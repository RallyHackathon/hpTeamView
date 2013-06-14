Ext.define('CustomApp', {
    extend: 'Rally.app.App',

    launch: function () {
        this.callParent(arguments);

        this.add({
            xtype: 'container',
            layout: 'hbox',
            items: [
                {
                    xtype: 'rallyprojecttree',
                    topLevelModel: 'Project',
                    topLevelStoreConfig: {
                        fetch: ['Name', 'State', 'Children:summary[State]'],
                        filters: [
                            {
                                property: 'ObjectID',
                                value: '10022205382'
                            }
                        ],
                        context: {
                            project: '/project/10022205382'
                        }
                    },

                    listeners: {
                        itemselected: this.showReleaseAndIterationPicker,
                        toplevelload: function () {
                            this.down('.rallyprojecttree').drawChildItems(this.down('.rallyprojecttree').items.get(0));
                        },
                        scope: this
                    },
                    flex: 1
                },
                {
                    xtype: 'container',
                    itemId: 'projectScopeCt',
                    flex: 9
                }
            ]
        });


        this.subscribe(Rally.Message.objectUpdate, function (record, component) {
            if (!this.down('#dependentStoriesGrid').getStore().getById(record.getId())) {
                this.down('#dependentStoriesGrid').destroy();
                this.onScrumGridLoad();
            }

        }, this);
    },

    showReleaseAndIterationPicker: function (treeItem) {

        var projectScope = treeItem.getRecord().getRef().getUri();

        console.log(projectScope);

        if (this.projectScopeContent) {
            this.projectScopeContent.destroy();
        }

        this.projectScopeContent = this.down('#projectScopeCt').add({
            xtype: 'container',

            items: [
                {
                    xtype: 'container',
                    layout: 'hbox',
                    items: [
                        {
                            xtype: 'component',
                            html: 'Iteration: '
                        },
                        {
                            xtype: 'rallyiterationcombobox',
                            storeConfig: {
                                context: {
                                    project: projectScope
                                }
                            },
                            listeners: {
                                change: this.showGrid,
                                scope: this,
                                projectScope: projectScope
                            }
                        },
                        {
                            xtype: 'component',
                            html: 'Release: '
                        },
                        {
                            xtype: 'rallyreleasecombobox',
                            storeConfig: {
                                context: {
                                    project: projectScope
                                }
                            },
                            listeners: {
                                change: this.showGrid,
                                scope: this,
                                projectScope: projectScope
                            }
                        }
                    ]
                }
            ]
        });
    },

    showGrid: function (scopePicker, timeboxScope, oldScope, eOpts) {
        if (this.gridCt) {
            this.gridCt.destroy();
        }

        Rally.data.ModelFactory.getModels({
            types: ['Defect', 'User Story'],
            scope: this,
            success: function (models) {
                this.models = models;

                this.gridCt = this.projectScopeContent.add({
                    xtype: 'container',
                    layout: 'hbox',
                    items: [
                        {
                            xtype: 'container',
                            items: [
                                {
                                    xtype: 'rallygrid',
                                    title: 'User Stories',
                                    itemId: 'scrumStoriesGrid',
                                    store: this.createScrumGridStore(this.models['User Story'], timeboxScope, eOpts.projectScope, this.onScrumGridLoad),
                                    columnCfgs: [
                                        'FormattedID',
                                        'Name',
                                        'Owner',
                                        'Project',
                                        'Iteration',
                                        'Release',
                                        'ScheduleState',
                                        'Tags',
                                        'c_SWPWorkflowDependencies'
                                    ],
                                    listeners: {
                                        beforerender: function (grid) {
                                            grid.getView().getRowClass = function (record, rowIndex, rowParams, store) {
                                                return record.get("c_SWPWorkflowDependencies") === '' ? "row-valid" : "row-valid has-dependencies";
                                            }
                                        }
                                    }
                                },
                                {
                                    xtype: 'rallygrid',
                                    title: 'Defects',
                                    itemId: 'scrumDefectsGrid',
                                    store: this.createScrumGridStore(this.models.Defect, timeboxScope, eOpts.projectScope, this.onScrumGridLoad),
                                    columnCfgs: [
                                        'FormattedID',
                                        'Name',
                                        'Owner',
                                        'Project',
                                        'Iteration',
                                        'Release',
                                        'ScheduleState',
                                        'Tags',
                                        'c_SWPWorkflowDependencies'
                                    ],
                                    listeners: {
                                        beforerender: function (grid) {
                                            grid.getView().getRowClass = function (record, rowIndex, rowParams, store) {
                                                return record.get("c_SWPWorkflowDependencies") === '' ? "row-valid" : "row-valid has-dependencies";
                                            }
                                        }
                                    }
                                }
                            ],
                            flex: 1
                        },
                        {
                            xtype: 'container',
                            itemId: 'rightPaneCt',
                            flex: 1
                        }
                    ]
                });
            }
        });

    },

    createScrumGridStore: function (model, timeboxScope, projectScope, onLoad) {
        return Ext.create('Rally.data.WsapiDataStore', {
            model: model,
            autoLoad: true,
            context: {
                project: projectScope,
                projectScopeDown: true
            },
            filters: [
                {
                    property: timeboxScope.indexOf('iteration') !== -1 ? 'iteration' : 'release',
                    operator: '=',
                    value: timeboxScope
                }
            ],
            listeners: {
                load: onLoad,
                scope: this
            }
        });
    },

    onScrumGridLoad: function () {
        var storiesStore = this.gridCt.down('#scrumStoriesGrid').getStore();
        var defectsStore = this.gridCt.down('#scrumDefectsGrid').getStore();
        if (!storiesStore.isLoading() && !defectsStore.isLoading() && !this.down('#dependentStoriesGrid')) {
            this.renderDependentStoriesGrid(storiesStore.getRecords().concat(defectsStore.getRecords()));
        }
    },

    renderDependentStoriesGrid: function (records) {
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

            this.gridCt.down('#rightPaneCt').add({
                xtype: 'rallygrid',
                title: 'Dependent Stories',
                itemId: 'dependentStoriesGrid',
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

})
;