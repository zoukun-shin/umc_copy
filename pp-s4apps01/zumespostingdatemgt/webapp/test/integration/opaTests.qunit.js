sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'pp/zumespostingdatemgt/test/integration/FirstJourney',
		'pp/zumespostingdatemgt/test/integration/pages/ZC_TPP1019List',
		'pp/zumespostingdatemgt/test/integration/pages/ZC_TPP1019ObjectPage'
    ],
    function(JourneyRunner, opaJourney, ZC_TPP1019List, ZC_TPP1019ObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('pp/zumespostingdatemgt') + '/index.html'
        });

       
        JourneyRunner.run(
            {
                pages: { 
					onTheZC_TPP1019List: ZC_TPP1019List,
					onTheZC_TPP1019ObjectPage: ZC_TPP1019ObjectPage
                }
            },
            opaJourney.run
        );
    }
);