sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/ui/core/Messaging",
    "sap/ui/export/Spreadsheet",
    "sap/ui/export/library"

], function (Base, formatter, BusyDialog, Messaging, Spreadsheet, exportLibrary ) {
    "use strict";

    return Base.extend("mm.parkedinvoice.controller.Detail", {

        formatter: formatter,

        onInit: function () {
            this.getRouter().getRoute("Detail").attachMatched(this._initialize, this);
        },

        onBeforeRendering: function () {
            // Message
            this.getView().setModel(Messaging.getMessageModel(), "message");
            Messaging.registerObject(this.getView(), true);
        },

        _initialize: function (oEvent) {
            Messaging.removeAllMessages();
            var oMainBusyDialog = this.getModel("local").getProperty("/BusyDialog");
            var oArgs = oEvent.getParameter("arguments");
            var suuid = oArgs.uuid;
            var sjob_name = oArgs.job_name;
            if (!suuid) {
                // refresh web page
                var sHref = window.location.href;
                var matchResult = sHref.match(/Detail\('([^']+)'\)/);
                suuid = matchResult ? matchResult[1] : '';
            }
            this.getModel("local").setProperty("/uuid", suuid);
            this.getModel("local").setProperty("/job_name", sjob_name);

            this._refreshData(oMainBusyDialog);

        },

        onExportJobItem: function () {
            var oTable = this.byId("idJob_ItemTable");
            var oBinding = oTable.getBinding("rows");

            var aCols = this._createJobItemColumns();

            var oSettings = {
                workbook: {
                    columns: aCols,
                    context: {
                        application: "Job Result",
                        version: "1.0",
                        title: "Job Item Export"
                    }
                },
                dataSource: oBinding,
                fileName: "Job_Item.xlsx"
            };

            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy();
            });
        },

        _createJobItemColumns: function () {
            return [
                {
                    label: this.getResourceBundle().getText("job_result"),
                    property: "job_result"
                },
                {
                    label: this.getResourceBundle().getText("job_text"),
                    property: "job_text"
                },
                {
                    label: this.getResourceBundle().getText("job_status"),
                    property: "job_status"
                },
                {
                    label: this.getResourceBundle().getText("invno"),
                    property: "invno"
                },
                {
                    label: this.getResourceBundle().getText("posting_date"),
                    property: "posting_date",
                    type: "date"
                }
            ];
        },

        _refreshData: function (oMainBusyDialog) {
            var suuid = this.getModel("local").getProperty("/uuid");
            var sPath = "/" + this.getModel().createKey("JOB_Header", { uuid: suuid });
            this._CallODataV2("READ", sPath, [], { $expand: "to_JOB_Item" }, {}).then(function (oResponse) {
                oResponse.to_JOB_Item.results.sort(function (a, b) {
                    return a.JOB_ItemNo - b.JOB_ItemNo;
                });
                this.getModel("local").setProperty("/JOB_Header", oResponse);

                if (oMainBusyDialog) {
                    oMainBusyDialog.close();
                }
            }.bind(this), function (oError) {
                if (oMainBusyDialog) {
                    oMainBusyDialog.close();
                }
            }.bind(this));
        }
    });
});
