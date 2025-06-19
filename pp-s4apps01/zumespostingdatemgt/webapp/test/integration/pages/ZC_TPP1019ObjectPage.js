sap.ui.define(['sap/fe/test/ObjectPage'], function(ObjectPage) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ObjectPage(
        {
            appId: 'pp.zumespostingdatemgt',
            componentId: 'ZC_TPP1019ObjectPage',
            contextPath: '/ZC_TPP1019'
        },
        CustomPageDefinitions
    );
});