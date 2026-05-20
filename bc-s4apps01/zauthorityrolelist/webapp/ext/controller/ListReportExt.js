sap.ui.define([
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (BusyDialog, MessageBox, MessageToast) {
    'use strict';

    var _myFunction, _myBusyDialog;
    return {

        getAuthorityData: function (oModels, oViews) {
            _myFunction = sap.ui.require("bc/zauthorityrolelist/ext/controller/ListReportExt");
            _myBusyDialog = new BusyDialog();
            var oAuthorityModel = oModels.Authority;
            var oLocalModel = oModels.local;
            var oI18nModel = oModels.i18n;
            var _UserInfo = sap.ushell.Container.getService("UserInfo");
            var sUser = _UserInfo.getFullName() === undefined ? "" : _UserInfo.getFullName();
            var sEmail = _UserInfo.getEmail() === undefined ? "" : _UserInfo.getEmail();
            var oContextBinding = oAuthorityModel.bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zauthorityrolelist-View")) {
                    if (!this.oErrorMessageDialog) {
                        this.oErrorMessageDialog = new sap.m.Dialog({
                            type: sap.m.DialogType.Message,
                            state: "Error",
                            content: new sap.m.Text({
                                text: oI18nModel.getResourceBundle().getText("noAuthorityView", [sUser])
                            })
                        });
                    }
                    oViews.destroy();
                    this.oErrorMessageDialog.open();
                }
                oLocalModel.setProperty("/authorityCheck", {
                    button: {
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zauthorityrolelist-View")
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
                            text: oI18nModel.getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                oViews.destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));
        },

        // ADD BEGIN BY XINLEI XU 2026/04/13 AMO#5876
        onDownload: function (oEvent) {
            var that = this;
            var aItems = [];
            var aContexts = this._controller.extensionAPI.getSelectedContexts();
            aContexts.forEach(element => {
                let aSplitArray = element.getPath().split("'");
                aItems.push({
                    TimezoneOffset: -new Date().getTimezoneOffset() / 60, // Timezone offset in hours
                    RoleId: decodeURIComponent(aSplitArray[1])
                });
            });
            if (aItems.length === 0) {
                aItems.push({
                    TimezoneOffset: -new Date().getTimezoneOffset() / 60, // Timezone offset in hours
                    RoleId: ""
                });
            }
            _myFunction._callOData("EXPORT", aItems, that);
        },

        _callOData: function (bEvent, oRequestData, that) {
            var aPromise = [];
            aPromise.push(_myFunction._callODataAction(bEvent, oRequestData, that));
            try {
                _myBusyDialog.open();
                Promise.all(aPromise).then((aContext) => {
                    _myBusyDialog.close();
                    var aDownloadRecords = [];
                    for (const activeContext of aContext) {
                        var boundContext = activeContext.getBoundContext();
                        var object = boundContext.getObject();
                        aDownloadRecords.push({
                            RecordUUID: object.RecordUUID
                        });
                    }
                    aDownloadRecords.forEach(element => {
                        var sPath = "PrintRecord(RecordUUID=" + element.RecordUUID + ",IsActiveEntity=true)";
                        var sURL = that.getModel("Print").getServiceUrl() + sPath + '/PDFContent';
                        sap.m.URLHelper.redirect(sURL, true);
                    });
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                    _myBusyDialog.close();
                });
            } catch (error) {
                MessageBox.error(error);
                _myBusyDialog.close();
            }
        },

        _callODataAction: function (bEvent, aRequestData, that) {
            return new Promise((resolve, reject) => {
                var processLogic = that.getModel().bindContext("/Role/com.sap.gateway.srvd.zui_permission_access_o4.v0001.processLogic(...)");
                processLogic.setParameter("Event", bEvent);
                processLogic.setParameter("Zzkey", JSON.stringify(aRequestData));
                processLogic.setParameter("RecordUUID", "");
                processLogic.execute("$auto", false, null, /*bReplaceWithRVC*/false).then(() => {
                    resolve(processLogic);
                }).catch((error) => {
                    reject(error);
                });
            });
        },
        // ADD END BY XINLEI XU 2026/04/13 AMO#5876
    };
});
