sap.ui.define([
    "../model/formatter",
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox"
], function (formatter, Controller, UIComponent, MessageBox) {
    "use strict";

    return Controller.extend("sd.zdelivtransfee.controller.Main", {
        formatter: formatter,
        
        onInit: function () {
            var that = this;
            // *************************************************
            var oMessageTemplate = new sap.m.MessageItem({
                type: '{type}',
                title: '{title}',
                description: '{description}',
                subtitle: '{subtitle}',
                counter: 1
            });
             this._myMessageView = new sap.m.MessageView({
                showDetailsPageHeader: false,
                itemSelect: function () {
                    oBackButton.setVisible(true);
                },
                items: {
                    path: "/MessageItems",
                    template: oMessageTemplate
                }
            });
            var oBackButton = new sap.m.Button({
                icon: sap.ui.core.IconPool.getIconURI("nav-back"),
                visible: false,
                press: function () {
                    that._myMessageView.navigateBack();
                    oBackButton.setVisible(false);
                }
            });
            this._myMessageDialog = new sap.m.Dialog({
                resizable: true,
                content: this._myMessageView,
                beginButton: new sap.m.Button({
                    press: function () {
                        that._myMessageDialog.close();
                    },
                    text: "{i18n>CloseBtn}"
                }),
                customHeader: new sap.m.Bar({
                    contentLeft: [oBackButton],
                    contentMiddle: [
                        new sap.m.Title({
                            text: "{i18n>Results}",
                            level: "H1"
                        })
                    ]
                }),
                contentHeight: "50%",
                contentWidth: "30%",
                verticalScrolling: false
            });
            // *************************************************
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            var oContextBinding = this.getView().getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zdelivtransfee-View")) {
                    if (!this.oErrorMessageDialog) {
                        this.oErrorMessageDialog = new sap.m.Dialog({
                            type: sap.m.DialogType.Message,
                            state: "Error",
                            content: new sap.m.Text({
                                text: this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityView", [sUser])
                            })
                        });
                    }
                    this.getView().destroy();
                    this.oErrorMessageDialog.open();
                }
                this.getOwnerComponent().getModel("local").setProperty("/authorityCheck", {
                    button: {
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zdelivtransfee-View"),
                        Print: aAllAccessBtns.some(btn => btn.AccessId === "zdelivtransfee-Reprocessing"),
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
                            text: this.getView().getModel("i18n").getResourceBundle().getText("getAuthorityFailed")
                        })
                    });
                }
                this.getView().destroy();
                this.oErrorMessageDialog.open();
            }.bind(this));
        },

        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        onBeforeRebindTable: function (oEvent) {
            var aFilters = oEvent.getParameter("bindingParams").filters;
            var iSelectedIndex = this.byId("idRBG1").getSelectedIndex();
            var sTotalDimension = iSelectedIndex;
            var oTotalDimension = new sap.ui.model.Filter({
                path: "TotalDimension",
                operator: "EQ",
                value1: sTotalDimension
            });
             aFilters.push(oTotalDimension);

            //Authority check 
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            var oUserEmail = new sap.ui.model.Filter({
                path: "UserEmail",
                operator: "EQ",
                value1: sEmail
            });
            aFilters.push(oUserEmail);
        },

        onInputLiveChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");

            // Only keep number
            sValue = sValue.replace(/\D/g, "");

            oEvent.getSource().setValue(sValue);
        },

        onPressBtn: function (sEvent) {
            var that = this;
            if (sEvent === "Reprocessing") {
                if (!this._oReprocessingDialog) {
                    this._oReprocessingDialog = sap.ui.xmlfragment(
                        "sd.zdelivtransfee.fragments.ReprocessingDialog", this
                    );
                    this.getView().addDependent(this._oReprocessingDialog);
                }
                this._oReprocessingDialog.open();
            }
        },

        onDialogConfirm: function () {
            var oDialog = this._oReprocessingDialog;
            var sSalesOrg = sap.ui.getCore().byId("idInputSalesOrg").getValue();
            var sBillingMonth = sap.ui.getCore().byId("idInputBillingMonth").getValue();
            var sFieldName = '';

            if (!sSalesOrg) {
                sFieldName = this.getView().getModel("i18n").getResourceBundle().getText("SalesOrganization");
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("inputRequired",[sFieldName]));
                return;
            }

            if (!sBillingMonth) {
                sFieldName = this.getView().getModel("i18n").getResourceBundle().getText("BillingMonth");
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("inputRequired",[sFieldName]));
                return;
            }

            oDialog.close();

            var aAuthoritySalesOrgSet = this.getView().getModel("local").getProperty("/authorityCheck/data/SalesOrgSet");
            if (!aAuthoritySalesOrgSet.some(data => data.SalesOrganization === sSalesOrg)) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthoritySalesOrg", [sSalesOrg]));     
                return;
            }

            var filter = { 
                'SalesOrganization':sSalesOrg,
                'BillingMonth':sBillingMonth
            };

            var oRequestData = {
                filter,
                user: this._UserInfo.getLastName() + " " + this._UserInfo.getFirstName(),
                // username: "Xinlei Xu",
                // datetime: this._getCurrentDateTime()
            }

            this._callOData("Reprocessing", oRequestData);
        },
        
        onDialogCancel: function () {
            this._oReprocessingDialog.close();
        },

        _callOData: function (sEvent, oRequestData) {
            var that = this;
            var aPromise = [];
            aPromise.push(this._CallODataV2("ACTION", "/processLogic", [], {
                "Event": sEvent,
                "Zzkey": JSON.stringify(oRequestData),
                "RecordUUID":""
            }, {}));

            try {
                Promise.all(aPromise).then((aContext) => {
                    for (const activeContext of aContext) {
                        if (sEvent === "Reprocessing") {
                            var oResult = JSON.parse(activeContext.processLogic.Zzkey);
                            if (oResult.MSGTYPE === 'S') {
                                MessageBox.success(this.getView().getModel("i18n").getResourceBundle().getText("Jobname", [oResult.JOBNAME]));     
                            } else {
                                MessageBox.error(oResult.MESSAGE);     
                            }
                        } 

                    }
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
    
                });
            } catch (error) {
                MessageBox.error(error);
            }
        },

        _CallODataV2: function (sMethod, sPath, aFilters, mUrlParameter, oRequestData) {
            var that = this;
            var oBusyDialog = new sap.m.BusyDialog();
            oBusyDialog.open();
            return new Promise(function (resolve, reject) {
                var mParameters = {
                    method: sMethod === "READ" ? "GET" : "POST",
                    filters: aFilters,
                    urlParameters: mUrlParameter,
                    success: function (oResponse) {
                        oBusyDialog.close();
                        resolve(oResponse);
                    },
                    error: function (oErr) {
                        oBusyDialog.close();
                        reject(JSON.parse(oErr.responseText));
                    }
                };
                switch (sMethod) {
                    case "READ":
                        that.getView().getModel().read(sPath, mParameters);
                        break;
                    case "CREATE":
                        that.getView().getModel().create(sPath, oRequestData, mParameters);
                        break;
                    case "UPDATE":
                        that.getView().getModel().update(sPath, oRequestData, mParameters);
                        break;
                    case "DELETE":
                        that.getView().getModel().remove(sPath, mParameters);
                        break;
                    case "ACTION":
                        that.getView().getModel().callFunction(sPath, mParameters);
                        break;
                    default:
                        break;
                }
            });
        },

        _getCurrentDateTime: function () {
            var date = new Date();
            var sTime = date.getUTCFullYear().toString() +
                this._pad2(date.getUTCMonth() + 1) +
                this._pad2(date.getUTCDate()) +
                this._pad2(date.getUTCHours()) +
                this._pad2(date.getUTCMinutes()) +
                this._pad2(date.getUTCSeconds());
            return sTime;
        },
        _pad2: function (n) {
            return parseInt(n) < 10 ? "0" + parseInt(n) : n;
        },

        onsMrilterBarInitialized: function (oEvent) {
            var oSmartFilterBar = oEvent.getSource();
            oSmartFilterBar.setFilterData({
      
            });
        },

        // Checkbox Event
        onSelect: function (oEvent) {
           
        },

        // Go Event
        onSearch: function (oEvent) {
           
        },

        onBeforeExport: function (oEvent) {
            var oSettings = oEvent.getParameter("exportSettings");
            var columns = oSettings.workbook.columns;
            columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "OpeningBalInCoCodeCrcy": 
                    case "ClosingBalInCoCodeCrcy": 
                        oColumn.type = sap.ui.export.EdmType.Number;
                        break;
                    default:
                        break;
                }
            });
        },
    });
});

