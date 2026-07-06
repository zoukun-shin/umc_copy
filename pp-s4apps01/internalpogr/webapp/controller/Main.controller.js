sap.ui.define([
    "./BaseController",
], function (BaseController) {
    "use strict";

    return BaseController.extend("pp.internalpogr.controller.Main", {

        onInit: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();

            // detect preview environment: can be forced via ?env=preview or inferred from hostname
            function isPreviewEnv() {
                try {
                    var search = window.location.search || "";
                    if (search.indexOf('env=preview') !== -1) { return true; }
                    var hash = window.location.hash || "";
                    if (hash.indexOf('#app-preview') === 0) { return true; }
                    var host = window.location.hostname || "";
                    var indicators = ["localhost", "127.0.0.1", "preview", "webide", "sapappstudio"];
                    return indicators.some(function (p) { return host.indexOf(p) !== -1; });
                } catch (e) {
                    return false;
                }
            }

            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            if (isPreviewEnv()) {
                // In preview environment use fixed test email
                sEmail = "xinlei.xu@sh.shin-china.com";
            }
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "internalpogr-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "internalpogr-View"),
                        Check: aAllAccessBtns.some(btn => btn.AccessId === "internalpogr-Check"),
                        Validate: aAllAccessBtns.some(btn => btn.AccessId === "internalpogr-PostCancel"),
                        Post: aAllAccessBtns.some(btn => btn.AccessId === "internalpogr-Post")
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
