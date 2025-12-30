sap.ui.define([
	"./Base",
	"../model/formatter",
	"sap/m/MessageBox",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/BusyDialog",
	"sap/ui/export/Spreadsheet",
	"./messages",
], function (
	Base,
	formatter,
	MessageBox,
	Filter,
	FilterOperator,
	BusyDialog,
	Spreadsheet,
	messages
) {
	"use strict";

	return Base.extend("fico.generalledger.controller.Main", {
		formatter: formatter,
		messages: messages,
		onInit: function () {
			this._LocalData = this.getOwnerComponent().getModel("local");
			this._oDataModel = this.getOwnerComponent().getModel();
			this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			this._BusyDialog = new BusyDialog();
			var oRouter = this.getRouter();
			oRouter.getRoute("Main").attachMatched(this._onRouteMatched, this);
		},
		_onRouteMatched: function (oEvent) {
			this.getView().getModel().resetChanges();
			this._UserInfo = sap.ushell.Container.getService("UserInfo");
		},

		onBeforeRebindTable: function (oEvent) {
		}
		
	});
});