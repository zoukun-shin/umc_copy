sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/ui/core/Messaging"

], function (Base, formatter, BusyDialog, Messaging) {
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
            this._authorityCheck();
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

        _authorityCheck: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-View"),
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
