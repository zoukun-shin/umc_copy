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

	return BaseController.extend("pp.materialcrossref.controller.Display", {
		formatter: formatter,

		onInit: function () {
			this._LocalData = this.getOwnerComponent().getModel("local");
			this._oDataModel = this.getOwnerComponent().getModel();
			this._oWorkFlow = this.getOwnerComponent().getModel("WorkFlow");

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
			var oFilter = oEvent.getParameter("bindingParams").filters;
		},

		onDeleteFlag: function () {
			var aSelectedItems = this.preparePostBody();
			if (aSelectedItems.length === 0) {
				return;
			}
			this.postAction("deleteflag", JSON.stringify(aSelectedItems));
		},

		onDeleteCancel: function () {
			var aSelectedItems = this.preparePostBody();
			if (aSelectedItems.length === 0) {
				return;
			}
			this.postAction("deletecancel", JSON.stringify(aSelectedItems));
		},

		createSingle: function () {
			this.openCreateDialog();
		},

		preparePostBody: function () {
			var aData = [];
			var postDocs = [];
			// 根据id值获取table 
			var oTable = this.getView().byId("idMaterialCrossRefTable");
			var listItems = oTable.getSelectedIndices();
			if (listItems.length === 0) {
				messages.showError(this._ResourceBundle.getText("msgNoSelect"));
				return aData;
			}
			listItems.forEach(_getData, this); //根据选择的行获取具体的数据
			function _getData(iSelected, index) { //sSelected为选中的行
				let key = oTable.getContextByIndex(iSelected).getPath();
				let lineData = this._oDataModel.getProperty(key); //根据选中的行获取到ODATA键值，然后再获取到具体属性值
				let postData = JSON.parse(JSON.stringify(lineData));
				aData.push(postData);
			}
			return aData;
		},

		removeDuplicates: function (arr) {
			const map = new Map();
			arr.forEach(item => {
				const key = `${item.PrNo}`;
				map.set(key, item);
			});
			return Array.from(map.values());
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

						if (sAction === "createsingle") {
							var bAllSuccess = result.length > 0 && result.every(function (item) {
								return item.STATUS === "S";
							});

							if (bAllSuccess) {
								messages.showSuccess(this._ResourceBundle.getText("CreateSingleSuccess"));
							} else {
								var oFail = result.find(function (item) {
									return item.STATUS !== "S";
								}) || {};

								// 优先用后端 message
								var sErr = oFail.MESSAGE || oFail.message || oFail.Msg || "";
								if (sErr) {
									messages.showError(sErr);
								} else {
									messages.showError(this._ResourceBundle.getText("CreateSingleError"));
								}
							}
						}

						// deleteflag / deletecancel
						if (sAction === "deleteflag" || sAction === "deletecancel") {
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
								var sMsgKey = (sAction === "deleteflag")
									? "DeleteFlagSuccess"
									: "DeleteCancelSuccess";
								messages.showSuccess(this._ResourceBundle.getText(sMsgKey));
							} else {
								var sPrefixKey = (sAction === "deleteflag")
									? "DeleteFlagFailedPrefix"
									: "DeleteCancelFailedPrefix";
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

		openCreateDialog: function () {

			if (!this._oCreateDialog) {

				this._oCreateDialog = Fragment.load({
					id: this.getView().getId(),
					name: "pp.materialcrossref.fragment.Create",
					controller: this
				}).then(function (oDialog) {

					this.getView().addDependent(oDialog);

					oDialog.setModel(new JSONModel({
						Plant: "",
						DeliveryMaterial: "",
						ReceiptMaterial: "",
						PurchaseOrder: "",
						PurchaseOrderItem: ""
					}), "dialog");

					return oDialog;

				}.bind(this));
			}

			this._oCreateDialog.then(function (oDialog) {
				oDialog.open();
			});

		},

		onCreateDialogOK: function () {

			var oDialog = this.byId("CreateSingle");
			var oData = oDialog.getModel("dialog").getData();

			var aPostData = [{
				Plant: oData.Plant,
				DeliveryMaterial: oData.DeliveryMaterial,
				ReceiptMaterial: oData.ReceiptMaterial,
				PurchaseOrder: oData.PurchaseOrder,
				PurchaseOrderItem: oData.PurchaseOrderItem
			}];

			this.postAction(
				"createsingle",
				JSON.stringify(aPostData));

			oDialog.close();
		},
		onCreateDialogCancel: function () {

			this.byId("CreateSingle").close();

		},

		base64ToHex: function (base64) {
			const raw = atob(base64);  // Decode the base64 string
			let result = '';
			for (let i = 0; i < raw.length; i++) {
				const hex = raw.charCodeAt(i).toString(16).padStart(2, '0');
				result += hex;
			}
			return result.toLowerCase();
		},

		onBeforeExport: function (oEvent) {
			var mExcelSettings = oEvent.getParameter("exportSettings");
			mExcelSettings.workbook.columns.forEach(function (oColumn) {
				switch (oColumn.property) {
					// Date
					case "CreateAt":
					case "ChangeAt":
						oColumn.type = sap.ui.export.EdmType.DateTime;
						break;
				}
			});
		},
	});
});