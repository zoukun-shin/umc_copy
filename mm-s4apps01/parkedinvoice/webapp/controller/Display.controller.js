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
			this._authorityCheck();
		},

		_authorityCheck: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            var oContextBinding = this.getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
                "$expand": "_AssignPlant,_AssignCompany,_AssignSalesOrg,_AssignPurchOrg,_AssignRole($expand=_UserRoleAccessBtn)"
            });
            oContextBinding.requestObject().then(function (context) {
                var aAccessBtns = [],
                    aAllAccessBtns = [];
                if (context._AssignRole && context._AssignRole.length > 0) {
                    context._AssignRole.forEach(role => {
                        aAccessBtns.push(role._UserRoleAccessBtn);
                    });
                    aAllAccessBtns = aAccessBtns.flat();
                }
                if (!aAllAccessBtns.some(btn => btn.AccessId === "parkedinvoice-View")) {
                    if (!this.oErrorMessageDialog) {
                        this.oErrorMessageDialog = new sap.m.Dialog({
                            type: sap.m.DialogType.Message,
                            state: "Error",
                            content: new sap.m.Text({
                                text: this.getModel("i18n").getResourceBundle().getText("noAuthorityView", [sUser])
                            })
                        });
                    }
                    this.getView().destroy();
                    this.oErrorMessageDialog.open();
                }
                this.getModel("local").setProperty("/authorityCheck", {
                    button: {
                        //View: aAllAccessBtns.some(btn => btn.AccessId === "parkedinvoice-View"),
                        View: aAllAccessBtns.some(btn => btn.AccessId === "parkedinvoice-View"),
						Unconfirm: aAllAccessBtns.some(btn => btn.AccessId === "parkedinvoice-Unconfirm"),
                        Confirm: aAllAccessBtns.some(btn => btn.AccessId === "parkedinvoice-Confirm"),
                        Post: aAllAccessBtns.some(btn => btn.AccessId === "parkedinvoice-Post"),
                    },
                    data: {
                        PlantSet: context._AssignPlant,
                        CompanySet: context._AssignCompany,
                        SalesOrgSet: context._AssignSalesOrg,
                        PurchOrgSet: context._AssignPurchOrg,
                        RoleSet: context._AssignRole
                    }
                });
            }.bind(this), function (oError) {
                if (!this.oErrorMessageDialog) {
                    this.oErrorMessageDialog = new sap.m.Dialog({
                        type: sap.m.DialogType.Message,
                        state: "Error",
                        content: new sap.m.Text({
                            text: this.getModel("i18n").getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                this.getView().destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));
        },

		onBeforeRebindTable: function (oEvent) {
			var aFilters = oEvent.getParameter("bindingParams").filters;
			var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
			aFilters.push(new Filter("UserEmail", FilterOperator.EQ, sEmail));
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
		},
		onBeforeExport: function (oEvent) {
            var mExcelSettings = oEvent.getParameter("exportSettings");
            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this._exportExcel(mExcelSettings, sFileName);
        },

        _exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.workbook.columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    //  Date
                    case "ScheduleLineDeliveryDate":
                    case "DocumentDate":
                    case "CreationDate":
                    case "PurchaseOrderDate":
                    case "PostingDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    //  Number 分隔符 没有小数位
                    // case "CurrentPrice":
                    // case "NewPrice":
                    // case "Difference":
                    //     oColumn.type = sap.ui.export.EdmType.Number;
                    //     oColumn.delimiter = true;
                    //     oColumn.scale = 3;
                    //     oColumn.textAlign = "End";
                    //     break;
                    // case "OrderQuantity":
                    //     oColumn.type = sap.ui.export.EdmType.Number;
                    //     oColumn.delimiter = true;
                    //     oColumn.scale = 2;
                    //     oColumn.textAlign = "End";
                    //     break;
                    // case "NetPriceQuantity":
                    // case "ConditionQuantity":
                    //     oColumn.type = sap.ui.export.EdmType.Number;
                    //     oColumn.delimiter = true;
                    //     oColumn.textAlign = "End";
                    //     break;
                }
            });
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
	});
});