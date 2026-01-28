sap.ui.define([
    "./Base",
    "./ValueHelpDialog",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/generic/app/navigation/service/NavigationHandler"
], function (Base, ValueHelpDialog, formatter, BusyDialog, MessageBox, MessageToast, Fragment, NavigationHandler) {
    "use strict";

    var _myMessageView, _myMessageDialog;
    return Base.extend("pp.zngmanangement.controller.Main", {

        ValueHelpDialog: ValueHelpDialog,
        formatter: formatter,

        onInit: function () {
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);

            // create an instance of the navigation handler
            this.oNavigationHandler = new NavigationHandler(this);
            // on back navigation, the previous app state is returned in a Promise
            this.oNavigationHandler.parseNavigation().done(this.onNavigationDone.bind(this));

            // *************************************************
            var oMessageTemplate = new sap.m.MessageItem({
                type: '{type}',
                title: '{title}',
                description: '{description}',
                subtitle: '{subtitle}',
                counter: 1
            });
            _myMessageView = new sap.m.MessageView({
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
                    _myMessageView.navigateBack();
                    oBackButton.setVisible(false);
                }
            });
            _myMessageDialog = new sap.m.Dialog({
                resizable: true,
                content: _myMessageView,
                beginButton: new sap.m.Button({
                    press: function () {
                        _myMessageDialog.close();
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
        },

        _initialize: function () {
            this._BusyDialog = new BusyDialog();
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-View"),
                        Create: aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-Create"),
                        DeleteItem: aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-DeleteItem"),
                        Move1Post: aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-Move1Post"),
                        Move1Cancel: aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-Move1Cancel"),
                        Move2Post: aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-Move2Post"),
                        Move2Cancel: aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-Move2Cancel"),
                        Edit: aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-Edit"),
                        DeleteNG: aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-DeleteNG"),
                        Save: aAllAccessBtns.some(btn => btn.AccessId === "zngmanangement-Save")
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

        /**
         * if navigated back with appstate enabled then rehydrate the page using the
         * stored data
         * @param {Object} oAppData data persisted via iAppState
         * @param {Object} oURLParameters paramters passed in
         * @param {String} sNavType type of navigation
         */
        onNavigationDone: function (oAppData, oURLParameters, sNavType) {
            switch (sNavType) {
                case "initial": // NavType.initial:
                    break;
                case "iAppState": // NavType.iAppState:
                    // this._oAppState = oAppData.customData;
                    // var oFilterBar = this.byId("idSmartFilterBar");
                    // var oSmartTable = this.byId("idSmartTable");
                    // oFilterBar.setDataSuiteFormat(JSON.stringify(this._oAppState.selectionVariant), true);
                    break;
            }
        },

        onSearch: function () {
            var oSmartTable = this.byId("idSmartTable");
            var oFilterBar = this.byId("idSmartFilterBar");
            var mInnerAppData = {
                selectionVariant: oFilterBar.getDataSuiteFormat(),
                tableVariantId: oSmartTable.getCurrentVariantId()
            };
            this.oNavigationHandler = new NavigationHandler(this);
            this.oNavigationHandler.storeInnerAppStateAsync(mInnerAppData);
        },

        onBeforeRebindTable: function (oEvent) {
            var mBindingParams = oEvent.getParameter("bindingParams");
            mBindingParams.parameters["expand"] = "to_NG_Post_History";
        },

        onShowOperationLog: function (oEvent) {
            var oClickRow = oEvent.getSource().getParent();
            var oBindingContext = oClickRow.getBindingContext();
            var oClickRowData = this.getModel().getObject(oBindingContext.getPath());
            var aOperationLogs = [];
            for (let i = 0; i < oClickRowData.to_NG_Post_History.__list.length; i++) {
                var sPath = "/" + oClickRowData.to_NG_Post_History.__list[i];
                var log = this.getModel().getObject(sPath);
                log.CreatedAt = log.CreatedAt.toLocaleString();
                log.StatusState = this.formatter.formatState(log.Status);
                log.StatusIcon = this.formatter.formatStateIcon(log.Status);
                aOperationLogs.push(log);
            }
            aOperationLogs.sort(function (a, b) {
                return a.Seq - b.Seq;
            });
            this.getModel("local").setProperty("/OperationLogs", aOperationLogs);
            Fragment.load({
                name: "pp.zngmanangement.fragments.OperationLogDialog",
                controller: this
            }).then(function (oDialog) {
                //ダイアログがロードされたら
                this._oOperationLogDialog = oDialog;
                //ダイアログからモデルを使用できるようにする
                this.getView().addDependent(this._oOperationLogDialog);
                this._oOperationLogDialog.addButton(new sap.m.Button({
                    text: "{i18n>CloseBtn}",
                    press: function () {
                        this._oOperationLogDialog.destroy();
                    }.bind(this)
                }));
                this._oOperationLogDialog.setTitle(this.getResourceBundle().getText("OperationLog", [oClickRowData.NG_No + "-" + oClickRowData.NG_ItemNo]));
                this._oOperationLogDialog.open();
            }.bind(this));
        },

        onRowActionPress: function (oEvent) {
            var oContext = oEvent.getParameter("row").getBindingContext();
            var oRow = this.getModel().getObject(oContext.getPath());
            this._BusyDialog.open();
            this.getModel("local").setProperty("/BusyDialog", this._BusyDialog);
            // var appStateKey = "";
            // var url = window.location.href;
            // var i = url.search('sap-iapp-state');
            // if (i > 0) {
            //     i = i + 15;
            //     appStateKey = url.substring(i);
            // }
            this.getRouter("Detail").navTo("Detail", { NG_No: oRow.NG_No }, false);
        },

        rowSelectionChange: function (oEvent) {
            var bEnabled = false;
            var aSelectedIndices = oEvent.getSource().getSelectedIndices();
            if (aSelectedIndices.length > 0) {
                bEnabled = true;
            }
            this.getModel("local").setProperty("/Control/requiredSelection", bEnabled);
        },

        onPressBtn: function (sEvent) {
            switch (sEvent) {
                case "Create":
                    this._openCreateDialog();
                    break;
                case "DeleteItem":
                case "Move1Post":
                case "Move1Cancel":
                case "Move2Post":
                case "Move2Cancel":
                    this._processRequest(sEvent);
                default:
                    break;
            }
        },

        _openCreateDialog: function () {
            var bEnabled = false;
            var aPlantSet = this.getModel("local").getProperty("/authorityCheck/data/PlantSet");
            this.getModel("local").setProperty("/NG_Header", { NG_No: "INITIAL", Plant: "", PlantName: "", to_NG_Item: { results: [] } });
            if (aPlantSet.length > 0) {
                this.getModel("local").setProperty("/NG_Header/Plant", aPlantSet[0].Plant);
                this.getModel("local").setProperty("/NG_Header/PlantName", aPlantSet[0].PlantName);
                bEnabled = true;
            }
            this.getModel("local").getProperty("/Control/itemNotPosted", true);
            Fragment.load({
                name: "pp.zngmanangement.fragments.CreateDialog",
                controller: this
            }).then(function (oDialog) {
                //ダイアログがロードされたら
                this._oSubmitDialog = oDialog;
                //ダイアログからモデルを使用できるようにする
                this.getView().addDependent(this._oSubmitDialog);
                this._oSubmitDialog.addButton(new sap.m.Button({
                    type: sap.m.ButtonType.Emphasized,
                    text: "{i18n>Create}",
                    enabled: bEnabled,
                    press: function () {
                        this._createNG();
                    }.bind(this)
                }));
                this._oSubmitDialog.addButton(new sap.m.Button({
                    text: "{i18n>Cancel}",
                    press: function () {
                        this.getModel("local").setProperty("/NG_Header/Plant", "");
                        this.getModel("local").setProperty("/NG_Header/PlantName", "");
                        this._oSubmitDialog.destroy();
                    }.bind(this)
                }));
                this._oSubmitDialog.open();
            }.bind(this));
        },

        onPlantLiveChange: function (oEvent) {
            var sText = oEvent.getParameter("value");
            this._oSubmitDialog.getButtons()[0].setEnabled(sText.length > 0);
        },

        onInputChange: function (oEvent) {
            var sOdataPath;
            var oControl = oEvent.getSource();
            var sPath = oControl.getBindingPath("value");
            var sValue = oEvent.getParameter('value');
            if (!sValue) {
                oControl.setValueState("None");
                this.getModel("local").setProperty(sPath + "Name", "");
                return;
            } else {
                switch (sPath) {
                    case '/NG_Header/Plant':
                        sOdataPath = "/I_Plant('" + sValue + "')";
                        break;
                    default:
                        break;
                }
                oControl.setValueState("Error");

                var oBusyDialog = new BusyDialog();
                oBusyDialog.open();
                this._CallODataV2("READ", sOdataPath, [], {}, {}).then(function (oResponse) {
                    oBusyDialog.close();
                    if (oResponse) {
                        oControl.setValueState("None");
                        switch (sPath) {
                            case '/NG_Header/Plant':
                                this.getModel("local").setProperty(sPath + "Name", oResponse["PlantName"]);
                                break;
                            default:
                                break;
                        }
                    }
                }.bind(this), function (oError) {
                    oBusyDialog.close();
                    MessageBox.error(this.getModel("i18n").getResourceBundle().getText("InvalidValue", [this.getModel("i18n").getResourceBundle().getText("Plant"), sValue]));
                }.bind(this));
            }
        },

        _createNG: function () {
            var sPlant = this.getModel("local").getProperty("/NG_Header/Plant");
            // Check Authority
            var aAuthorityPlantSet = this.getModel("local").getProperty("/authorityCheck/data/PlantSet");
            if (!aAuthorityPlantSet.some(data => data.Plant === sPlant)) {
                MessageBox.error(this.getModel("i18n").getResourceBundle().getText("noAuthorityPlant", [sPlant]));
                return;
            }
            this._BusyDialog.open();
            this.getModel("local").setProperty("/BusyDialog", this._BusyDialog);
            this.getRouter("Detail").navTo("Detail", { NG_No: "INITIAL" }, false);
            this._oSubmitDialog.destroy();
        },

        _processRequest: function (sEvent) {
            var that = this;
            var oTable = this.byId("idStandardListTable");
            var aSelectedIndices = oTable.getSelectedIndices();
            var iLen = aSelectedIndices.length;
            var aSelectedItems = [];
            if (!iLen) {
                MessageBox.error(this.getResourceBundle().getText("NoneSelected"));
                return;
            }
            while (iLen--) {
                var sPath = oTable.getContextByIndex(aSelectedIndices[iLen]).getPath();
                var oRow = this.getModel().getObject(sPath);
                aSelectedItems.push({
                    NG_No: oRow.NG_No,
                    NG_ItemNo: oRow.NG_ItemNo
                });
            }
            var sTitle = this.getResourceBundle().getText(sEvent);
            MessageBox.confirm(this.getResourceBundle().getText("confirmMessage", [sTitle]), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._CallODataV2("ACTION", "/processLogic", [], {
                            "Event": sEvent.toUpperCase(),
                            "Zzkey": JSON.stringify({
                                UserEmail: that._UserInfo.getEmail() === undefined ? "" : that._UserInfo.getEmail(),
                                to_NG_Item: {
                                    results: aSelectedItems
                                }
                            }),
                            "RecordUUID": ""
                        }, {}).then(function (oResponse) {
                            var aMessageItems = [];
                            var result = JSON.parse(oResponse.processLogic.Zzkey);
                            result.MESSAGEITEMS.forEach(element => {
                                aMessageItems.push({
                                    type: element.TYPE,
                                    title: element.TITLE,
                                    description: element.DESCRIPTION,
                                    subtitle: element.SUBTITLE
                                });
                            });
                            if (result.MESSAGEITEMS.length === 1 && result.MESSAGEITEMS[0].TYPE === "Success") {
                                oTable.clearSelection();
                            }
                            if (aMessageItems.length > 0) {
                                _myMessageView.setModel(that.getModel("local"));
                                that.getModel("local").setProperty("/MessageItems", aMessageItems);
                                _myMessageView.navigateBack();
                                that.getView().addDependent(_myMessageDialog);
                                _myMessageDialog.open();
                            }
                            that.getModel().resetChanges();
                            that.getModel().refresh();
                        }, function (oError) {
                            MessageBox.error(oError);
                        });
                    }
                },
                dependentOn: that.getView()
            });
        },
    });
});
