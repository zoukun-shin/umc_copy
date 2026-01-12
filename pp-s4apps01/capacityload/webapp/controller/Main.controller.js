sap.ui.define([
    "./BaseController",
    "../model/formatter",
	"./messages",
	"sap/ui/core/Fragment",
	"sap/m/Dialog",
	"sap/ui/model/Filter",
], (BaseController,formatter,messages,Fragment,Dialog,Filter) => {
    "use strict";

    return BaseController.extend("pp.capacityload.controller.Main", {
        formatter: formatter,
        onInit() {
            this._LocalData = this.getOwnerComponent().getModel("local");
			this._oDataModel = this.getOwnerComponent().getModel();
			this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			this._BusyDialog = new sap.m.BusyDialog();

			this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },
		_initialize: function () {
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            // var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
			sEmail = "xinlei.xu@sh.shin-china.com";
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "capacityload-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "capacityload-View"),
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
            var mBindingParams = oEvent.getParameter("bindingParams");
			var oFilter = mBindingParams.filters;

			var oNewFilter, aNewFilter = [];

			let oStartDate = this.byId("idDatePickerStartDate");
            let dStartDate = oStartDate.getDateValue();
            let oStartDate1 = this.byId("idDatePickerStartDate1");
            let dStartDate1 = oStartDate1.getDateValue();
            
            if ( this.vaildDate(oStartDate) || this.vaildDate(oStartDate1) ) {
                mBindingParams.preventTableBind="true";
            }
            
            if (oStartDate.isValidValue() && dStartDate && oStartDate1.isValidValue() && dStartDate1) {
                aNewFilter.push(new Filter("StartDate", "BT", this.formatter.odataDate(dStartDate), this.formatter.odataDate(dStartDate1))); 
            }
			oNewFilter = new Filter({
				filters:aNewFilter,
				and:true
			});
			if (aNewFilter.length > 0) {
				oFilter.push(oNewFilter);
			}

		},

        onDatePickerChange: function(oEvent) {
			// if ( this.vaildDate(oEvent.getSource()) ){
			// 	return;
			// }

			// var oControl = oEvent.getSource();

			// var oStartDate = oControl.getFrom();
			// var oEndDate = oControl.getTo();
			// // 如果未完整选择两个日期，则退出
			// if (!oStartDate || !oEndDate) {
			// 	return;
			// }

			// var sMode = this.byId("idProcessMode").getSelectedIndex()
			// // 调用核心算法，计算最大允许的截止日期
			// var oMaxEndDate = this._calculateMaxEndDate(oStartDate,sMode);
			
			// // 比较用户选择的截止日期是否超过了最大允许日期
			// if (oEndDate.getTime() > oMaxEndDate.getTime()) {
			// 	// 1.给出错误提示
			// 	switch(sMode) {
			// 		case 0:
			// 			sap.m.MessageToast.show("选择的时间范围不能超过一年", {
			// 				duration: 3000
			// 			});
			// 			break;
						
			// 		case 1:
			// 			sap.m.MessageToast.show("选择的时间范围不能超过一个月", {
			// 				duration: 3000
			// 			});
			// 			break;
			// 	}
				
			// 	// 2. 可选：自动将截止日期修正为最大允许值
			// 	// oControl.setDateValue([oStartDate, oMaxEndDate]);
				
			// 	// 3. 或者：清空选择，让用户重选（更清晰的交互）
			// 	oControl.setValue("");
			// 	oControl.setDateValue(null);
			// 	oControl.focus();
			// }
		},

        onUITableRowsUpdated: function (oEvent) {
			var oTable = oEvent.getSource();
			var aRows = oTable.getRows();
			if (aRows && aRows.length > 0) {
				for (var i = 0; i < aRows.length; i++) {
                    //
                    let aCells = aRows[i].getCells();
					// 第一行加颜色
					var sLineType = aRows[i].getBindingContext()?.getObject()?.LineType;
                    if (sLineType === "B01" || sLineType === "C01") {
                        $("#" + aRows[i].getId()).css("background-color", "#FFFF00");
                        $("#" + aRows[i].getId() + "-fixed").css("background-color", "#FFFF00");
                    }
                    else {
                        $("#" + aRows[i].getId()).css("background-color", "");
                        $("#" + aRows[i].getId() + "-fixed").css("background-color", "");
                    }
                    aCells?.forEach(function (oCell) {
                        let sProperty = oCell.getBinding("text").getPath();
                        if (sProperty === "WorkCenter" || sProperty === "StartDate") {
                            let sCellId = document.getElementById(oCell.getId()).parentNode.parentNode.id
                            $("#" + sCellId).css("background-color", "#FFFF00");
                            // $("#" + sCellId + "-fixed").css("background-color", "#FFFF00");
                        }
                    });

				}
			}
		},

        vaildDate: function (oControl) {
			var bValid = oControl.isValidValue();
			if (bValid) {
				oControl.setValueState("None");
				return false;
			} else {
				oControl.setValueState("Error");
				return true;
			}
		},
    });
});