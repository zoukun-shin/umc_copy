sap.ui.define([
	"./Base",
	"../model/formatter",
	"sap/m/MessageBox",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/BusyDialog",
	"sap/ui/export/Spreadsheet",
	"./messages",
	"sap/m/MessageToast"
], function (
	Base,
	formatter,
	MessageBox,
	Filter,
	FilterOperator,
	BusyDialog,
	Spreadsheet,
	messages,
	MessageToast
) {
	"use strict";

	return Base.extend("mm.parkedinvoice.controller.Display", {
		formatter: formatter,
		messages: messages,
		onInit: function () {
			this._LocalData = this.getOwnerComponent().getModel("local");
			this._oDataModel = this.getOwnerComponent().getModel();
			this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			this._BusyDialog = new BusyDialog();
			this._LocalData.setProperty("/onExportvisible", false)
			var oRouter = this.getRouter();
			oRouter.getRoute("Main").attachMatched(this._onRouteMatched, this);
		},
		_onRouteMatched: function (oEvent) {
			this.getView().getModel().resetChanges();
			this._UserInfo = sap.ushell.Container.getService("UserInfo");
		},

		onBeforeRebindTable: function (oEvent) {
			var aFilters = oEvent.getParameter("bindingParams").filters;
			var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
			aFilters.push(new Filter("UserEmail", FilterOperator.EQ, sEmail));

			var that = this;
			var iHeader = 0;
			var iItems = 0;
			var mParameters = {
				filters: aFilters,
				urlParameters: {
					"$top": 999999999
				},
				success: function (oResponse) {
					if (oResponse) {
						if (oResponse.results && oResponse.results.length > 0) {
							iItems = oResponse.results.length;
						}
					}
				},
				error: function (oErr) { }
			};
		},

		onCancel: function (oEvent) {
			var aSelectedItems = this.preparePostBody();
			if (aSelectedItems.length === 0) {
				return;
			}
			this.postAction("processLogic", JSON.stringify(aSelectedItems), "CANCEL");

		},
		onMark: function (oEvent) {
			var aSelectedItems = this.preparePostBody();
			if (aSelectedItems.length === 0) {
				return;
			}
			this.postAction("processLogic", JSON.stringify(aSelectedItems), "MARK");

		},
		onPost: function (oEvent) {
			this.postAction("processLogic", "", "POST");
		},
		preparePostBody: function (stextarea) {
			var aData = [];
			var oSmartTable = this.byId("idSmartTable");
			var oTable = oSmartTable.getTable();
			var aSelectedIndices = oTable.getSelectedIndices();
			if (aSelectedIndices.length === 0) {
				this.messages.showError(this._ResourceBundle.getText("msgNoSelect"));
				return aData;
			}
			aSelectedIndices.forEach(function (iIndex) {
				var oContext = oTable.getContextByIndex(iIndex);
				var oRow = oContext.getObject();

				aData.push({
					MaterialDocument: oRow.MaterialDocument,
					MaterialDocumentItem: oRow.MaterialDocumentItem,
					MaterialDocumentYear: oRow.MaterialDocumentYear
				});
			});
			return aData;
		},
		postAction: function (sAction, postData, sEvent) {
			this._BusyDialog.open();
			var oModel = this._oDataModel;
			oModel.callFunction(`/${sAction}`, {
				method: "POST",
				// groupId: "myId",//如果设置groupid，会多条一起进入action
				changeSetId: 1,
				//建议只传输前端修改的参数，其他字段从后端获取
				urlParameters: {
					Event: sEvent,
					Zzkey: postData
				},
				success: function () {
					this._BusyDialog.close();
					this._oDataModel.refresh(true);
					var successtext;
					if (sEvent === "POST"){
						successtext = this._ResourceBundle.getText("msgPostSuccess")
					}	
					else{
						successtext = this._ResourceBundle.getText("msgMarkChangeSuccess")
					}
					
					MessageToast.show(successtext );
					// this.messages.showSuccess(this.getModel("i18n").getResourceBundle().getText(success));
				}.bind(this),
				error: function (oError) {
					this._BusyDialog.close();
					this.messages.showError(messages.parseErrors(oError));
				}.bind(this)
			});
		}
	});
});