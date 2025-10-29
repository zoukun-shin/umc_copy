sap.ui.define(['sap/fe/test/ObjectPage'], function(ObjectPage) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ObjectPage(
        {
            appId: 'fico.zsalespurchaseprice',
            componentId: 'ZC_TFI_1024ObjectPage',
            contextPath: '/ZC_TFI_1024'
        },
        CustomPageDefinitions
    );
});