sap.ui.define([
    "./Base"
], (Base) => {
    "use strict";

    return Base.extend("pp.fglabel.controller.Main", {

        onInit() {
            this._UserInfo = sap.ushell.Container.getService("UserInfo").getUser();
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "fglabel-reportView")) {
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
                        Report1: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-generateView"),
                        Report2: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-reportView"),
                        Report3: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-modifyView"),
                        Find1: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-generateFind"),
                        Generate: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-generateGenerate"),
                        Clear1: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-generateClearHeader"),
                        Print1EN: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-generatePrintEN"),
                        Print1VN: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-generatePrintVN"),
                        Delete: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-reportDelete"),
                        Reset: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-reportDeleteCancel"),
                        Print2EN: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-reportPrintEN"),
                        Print2VN: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-reportPrintVN"),
                        Update: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-modifyUpdateInfo"),
                        Find2: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-modifyFind"),
                        Split: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-modifySplit"),
                        SplitChild: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-modifySplitChilddele"),
                        Clear2: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-modifyClearHeader"),
                        Print3EN: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-modifyPrintEN"),
                        Print3VN: aAllAccessBtns.some(btn => btn.AccessId === "fglabel-modifyPrintVN"),
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

    });
});
