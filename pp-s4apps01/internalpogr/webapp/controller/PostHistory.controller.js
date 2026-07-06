sap.ui.define([
	"./BaseController",
	"../model/formatter",
	"./messages",
	"sap/ui/model/Filter",
	"sap/m/BusyDialog",
	"sap/ui/core/Fragment",
	"sap/ui/model/json/JSONModel"
], function (
	BaseController,
	formatter,
	messages,
	Filter,
	BusyDialog,
	Fragment,
	JSONModel
) {
	"use strict";

	return BaseController.extend("pp.internalpogr.controller.PostHistory", {
		formatter: formatter,

		onInit: function () {
			this._LocalData = this.getOwnerComponent().getModel("local");
			this._oDataModel = this.getOwnerComponent().getModel();

			this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			this._BusyDialog = new BusyDialog();
			var oRouter = this.getRouter();
			oRouter.getRoute("RouteMain").attachMatched(this._onRouteMatched, this);

		},


		_onRouteMatched: function (oEvent) {
			this.getView().getModel().resetChanges();
			this._UserInfo = sap.ushell.Container.getService("UserInfo");
		},

		onBeforeRebindTable: function (oEvent) {
			this._oDataModel.resetChanges();
            let aFilters = oEvent.getParameters().bindingParams.filters;
            let oSmartFilterBar = this.byId("idSmartFilterBar");
            let sDel1 = this.byId("cbDeleteCancel").getSelectedKey();    
            let oDel = new sap.ui.model.Filter({
                path: "DisplayCancel",
                operator: "EQ",
                value1: sDel1
            });
            aFilters.push(oDel);
            let sDel2 = this.byId("cbDeleteText").getSelectedKey(); 
            let oDel2 = new sap.ui.model.Filter({
                path: "DisplayDNLongText",
                operator: "EQ",
                value1: sDel2
            });
            aFilters.push(oDel2);
		},

		onPostCancel: function () {
			var aSelectedItems = this.preparePostBody();
			if (aSelectedItems.length === 0) {
				return;
			}
			this.postAction("PostCancel", JSON.stringify(aSelectedItems));
		},

		preparePostBody: function () {
            var that = this;
            var listItems = this.byId("idMultiSelectionPlugin").getSelectedIndices();
            var selectedRows = [];
            listItems.forEach((item) => {
                var sPath = this.byId("HistoryTable").getContextByIndex(item).getPath();
                var oRow = this.getModel().getObject(sPath);
                delete oRow.__metadata;
                selectedRows.push(oRow);
            });
            let postDocs = [JSON.stringify(selectedRows)];
            return postDocs;
        },

		postAction: function (sAction, postData) {
			this._BusyDialog.open();
			var oModel = this._oDataModel;
			var i = 0;

			oModel.callFunction("/processLogic", {
				method: "POST",
				changeSetId: i,
				urlParameters: {
					Event: sAction,
					Zzkey: postData
				},

				success: function (oData) {
					try {
						let result = [];
						try {
							result = JSON.parse(oData["processLogic"].Zzkey || "[]");
						} catch (e) {
							messages.showError(this._ResourceBundle.getText("BackError"));
							return;
						}

						// PostCancel
						if (sAction === "PostCancel" ) {
							var aFailed = [];
							result.forEach(function (item, idx) {
								if (item.STATUS !== "S") {
									aFailed.push(
										this._ResourceBundle.getText("BatchItemFailed", [
											idx + 1,
											(item.MESSAGE || "")
										])
									);
								}
							}.bind(this));

							if (aFailed.length === 0) {
								var sMsgKey = (sAction === "PostCancel")
									? "PostCancelSuccess"
									: "PostCancelSuccess";
								messages.showSuccess(this._ResourceBundle.getText(sMsgKey));
							} else {
								var sPrefixKey = (sAction === "PostCancel")
									? "PostCancelFailedPrefix"
									: "PostCancelFailedPrefix";
								messages.showError(
									this._ResourceBundle.getText(sPrefixKey, [
										aFailed.join(this._ResourceBundle.getText("ListSeparator"))
									])
								);
							}
						}

						this.getView().getModel().refresh();
					} finally {
						this._BusyDialog.close();
					}
				}.bind(this),

				error: function (oError) {
					try {
						this._LocalData.setProperty("/recordCheckSuccessed", false);
						messages.showError(messages.parseErrors(oError));
					} finally {
						this._BusyDialog.close();
					}
				}.bind(this)
			});
		},

		onBeforeExport: function (oEvent) {
			var mExcelSettings = oEvent.getParameter("exportSettings");
			mExcelSettings.workbook.columns.forEach(function (oColumn) {
				switch (oColumn.property) {
					// Date
					case "CreateAt":
					case "ChnageAt":
						oColumn.type = sap.ui.export.EdmType.DateTime;
						break;
				}
			});
		},
	});
});