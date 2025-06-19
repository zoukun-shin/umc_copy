sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'pp.zumespostingdatemgt',
            componentId: 'ZC_TPP1019List',
            contextPath: '/ZC_TPP1019'
        },
        CustomPageDefinitions
    );
});