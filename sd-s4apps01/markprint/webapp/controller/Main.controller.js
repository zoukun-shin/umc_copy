sap.ui.define([
    "./Base",
], function (Base) {
    "use strict";

    return Base.extend("sd.markprint.controller.Main", {

        onInit: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "markprint-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "markprint-View"),
                        Edit: aAllAccessBtns.some(btn => btn.AccessId === "markprint-Edit"),
                        Delete: aAllAccessBtns.some(btn => btn.AccessId === "markprint-Delete"),
                        Check: aAllAccessBtns.some(btn => btn.AccessId === "markprint-Check"),
                        Execute: aAllAccessBtns.some(btn => btn.AccessId === "markprint-Execute"),
                        Export: aAllAccessBtns.some(btn => btn.AccessId === "markprint-Export"),
                        Print: aAllAccessBtns.some(btn => btn.AccessId === "markprint-Print"),
                        Clear: aAllAccessBtns.some(btn => btn.AccessId === "markprint-Clear")
                    },
                    data: {
                        PlantSet: context._AssignPlant,
                        CompanySet: context._AssignCompany,
                        SalesOrgSet: context._AssignSalesOrg,
                        PurchOrgSet: context._AssignPurchOrg,
                        RoleSet: context._AssignRole
                    }
                });
                var params = this.getOwnerComponent().getComponentData() && this.getOwnerComponent().getComponentData().startupParameters;
                if (sap.ushell && sap.ushell.Container) {
                    var bFlag = params && params.hasOwnProperty("JumpFromEmail") && params.JumpFromEmail[0];
                } else {
                    var oUriParameters = jQuery.sap.getUriParameters();
                    bFlag = oUriParameters.get("JumpFromEmail");
                }
                if (bFlag) {
                    this.getView().byId("id0IconTabBar").setSelectedKey("result2");
                }
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
    });
});
