sap.ui.define([
    "./Base",
    "./ValueHelpDialog",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Messaging",
    'sap/ui/core/message/Message',
    'sap/ui/core/message/MessageType',
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Base, ValueHelpDialog, formatter, BusyDialog, MessageBox, MessageToast, Messaging, Message, MessageType, Fragment, Filter, FilterOperator) {
    "use strict";

    return Base.extend("pp.zngmanangement.controller.Detail", {

        ValueHelpDialog: ValueHelpDialog,
        formatter: formatter,

        onInit: function () {
            this.getRouter().getRoute("Detail").attachMatched(this._initialize, this);
        },

        onBeforeRendering: function () {
            // Message
            this.getView().setModel(Messaging.getMessageModel(), "message");
            Messaging.registerObject(this.getView(), true);

            this._CallODataV2("READ", "/ZC_NG_MOVETYPEVH", [], {}, {}).then(function (oResponse) {
                this.getModel("local").setProperty("/MoveTypeVH", oResponse.results);
            }.bind(this), function (oError) {
                MessageBox.error(oError);
            }.bind(this));

            this._CallODataV2("READ", "/ZC_NG_MATERIALTYPEVH", [], {}, {}).then(function (oResponse) {
                this.getModel("local").setProperty("/MaterialTypeVH", oResponse.results);
            }.bind(this), function (oError) {
                MessageBox.error(oError);
            }.bind(this));
        },

        _initialize: function (oEvent) {
            Messaging.removeAllMessages();
            this._authorityCheck();
            var oMainBusyDialog = this.getModel("local").getProperty("/BusyDialog");
            var oArgs = oEvent.getParameter("arguments");
            var sNG_No = oArgs.NG_No;
            if (!sNG_No) {
                // refresh web page
                var sHref = window.location.href;
                var matchResult = sHref.match(/Detail\('([^']+)'\)/);
                sNG_No = matchResult ? matchResult[1] : '';
            }
            this.getModel("local").setProperty("/NG_No", sNG_No);
            if (sNG_No === "INITIAL") {
                // Create
                this._Operation = "Create";
                var sPlant = this.getModel("local").getProperty("/NG_Header/Plant");
                if (sPlant) {
                    // Create View Control
                    this.byId("idMessageStrip").setVisible(false);
                    this.byId("idButtonEdit").setVisible(false);
                    this.byId("idButtonDelete").setVisible(false);
                    this.byId("idMoveType").setEditable(true);
                    this.byId("idMaterialType").setEditable(true);
                    this.byId("idLocationFromText").setVisible(false);
                    this.byId("idLocationFromInput").setVisible(true);
                    this.byId("idLocationTo1Text").setVisible(false);
                    this.byId("idLocationTo1Input").setVisible(true);
                    this.byId("idLocationTo2Text").setVisible(true);
                    this.byId("idLocationTo2Input").setVisible(false);
                    this.getModel("local").setProperty("/Control/editable", true);
                    this.getModel("local").setProperty("/Control/enabled", true);
                    this.getModel("local").setProperty("/Control/showFooter", true);
                    if (oMainBusyDialog) {
                        oMainBusyDialog.close();
                    }
                } else {
                    this.getRouter("Main").navTo("Main", {}, false);
                }
            } else {
                // Display
                this._Operation = "Display";
                if (oMainBusyDialog) {
                    oMainBusyDialog.close();
                } else {
                    oMainBusyDialog = new BusyDialog();
                    oMainBusyDialog.open();
                }
                this._refreshData(oMainBusyDialog);

                // Display View Control
                this.byId("idMessageStrip").setVisible(false);
                this.byId("idMoveType").setEditable(false);
                this.byId("idMaterialType").setEditable(false);
                this.byId("idLocationFromText").setVisible(true);
                this.byId("idLocationFromInput").setVisible(false);
                this.byId("idLocationTo1Text").setVisible(true);
                this.byId("idLocationTo1Input").setVisible(false);
                this.byId("idLocationTo2Text").setVisible(true);
                this.byId("idLocationTo2Input").setVisible(false);
                this.getModel("local").setProperty("/Control/editable", false);
                this.getModel("local").setProperty("/Control/showFooter", false);
            }
            this.getModel("local").setProperty("/Operation", this._Operation);
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

        onEdit: function () {
            var sMoveType = this.getModel("local").getProperty("/NG_Header/MoveType");
            var bItemNotPosted = this.getModel("local").getProperty("/Control/itemNotPosted");
            // View Control
            if (bItemNotPosted) {
                this.byId("idMoveType").setEditable(true);
                this.byId("idMaterialType").setEditable(true);
                this.byId("idLocationFromText").setVisible(false);
                this.byId("idLocationFromInput").setVisible(true);
                this.byId("idLocationTo1Text").setVisible(false);
                this.byId("idLocationTo1Input").setVisible(true);
                if (sMoveType === "2") {
                    this.byId("idLocationTo2Text").setVisible(false);
                    this.byId("idLocationTo2Input").setVisible(true);
                } else {
                    this.byId("idLocationTo2Text").setVisible(true);
                    this.byId("idLocationTo2Input").setVisible(false);
                }
            } else {
                this.byId("idMoveType").setEditable(false);
                this.byId("idMaterialType").setEditable(false);
                this.byId("idLocationFromText").setVisible(true);
                this.byId("idLocationFromInput").setVisible(false);
                this.byId("idLocationTo1Text").setVisible(true);
                this.byId("idLocationTo1Input").setVisible(false);
                this.byId("idLocationTo2Text").setVisible(true);
                this.byId("idLocationTo2Input").setVisible(false);
            }
            this.byId("idButtonEdit").setVisible(false);
            this.getModel("local").setProperty("/Control/editable", true);
            this.getModel("local").setProperty("/Control/showFooter", true);
        },

        onCancel: function () {
            if (this._Operation === "Create") {
                // Clear Value
                var sPlant = this.getModel("local").getProperty("/NG_Header/Plant");
                var sPlantName = this.getModel("local").getProperty("/NG_Header/PlantName");
                this.getModel("local").setProperty("/NG_Header", { NG_No: "INITIAL", Plant: sPlant, PlantName: sPlantName, to_NG_Item: { results: [] } });
            } else {
                var oBusyDialog = new BusyDialog();
                oBusyDialog.open();
                this._refreshData(oBusyDialog);
            }
            // View Control
            this.byId("idMoveType").setEditable(false);
            this.byId("idMaterialType").setEditable(false);
            this.byId("idButtonEdit").setVisible(true);
            this.byId("idLocationFromText").setVisible(true);
            this.byId("idLocationFromInput").setVisible(false);
            this.byId("idLocationTo1Text").setVisible(true);
            this.byId("idLocationTo1Input").setVisible(false);
            this.byId("idLocationTo2Text").setVisible(true);
            this.byId("idLocationTo2Input").setVisible(false);
            this.getModel("local").setProperty("/Control/editable", false);
            this.getModel("local").setProperty("/Control/showFooter", false);
            this._resetControlState();
        },

        onInputChange: function (oEvent) {
            var sOdataPath;
            var oControl = oEvent.getSource();
            var sPath = oControl.getBindingPath("value");
            var sValue = oEvent.getParameter('value');
            var sPlant = this.getModel("local").getProperty("/NG_Header/Plant");
            if (!sValue) {
                oControl.setValueState("None");
                this.getModel("local").setProperty(sPath + "Name", "");
                return;
            } else {
                switch (sPath) {
                    case '/NG_Header/LocationFrom':
                    case '/NG_Header/LocationTo1':
                    case '/NG_Header/LocationTo2':
                        sOdataPath = "/I_StorageLocationStdVH(Plant='" + sPlant + "',StorageLocation='" + sValue + "')";
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
                            case '/NG_Header/LocationFrom':
                            case '/NG_Header/LocationTo1':
                            case '/NG_Header/LocationTo2':
                                this.getModel("local").setProperty(sPath + "Name", oResponse["StorageLocationName"]);
                                Messaging.removeMessages(Messaging.getMessageModel().getData().filter(e => e.code === sPath));
                                break;
                            default:
                                break;
                        }
                    }
                }.bind(this), function (oError) {
                    oBusyDialog.close();
                    Messaging.removeMessages(Messaging.getMessageModel().getData().filter(e => e.code === "/IWBEP/CX_MGW_BUSI_EXCEPTION"));
                    Messaging.removeMessages(Messaging.getMessageModel().getData().filter(e => e.code === "/IWBEP/CM_MGW_RT/020"));
                    var sText = "";
                    switch (sPath) {
                        case '/NG_Header/LocationFrom':
                            sText = this.getModel("i18n").getResourceBundle().getText("LocationFrom")
                            break;
                        case '/NG_Header/LocationTo1':
                            sText = this.getModel("i18n").getResourceBundle().getText("LocationTo1")
                            break;
                        case '/NG_Header/LocationTo2':
                            sText = this.getModel("i18n").getResourceBundle().getText("LocationTo2")
                            break;
                        default:
                            break;
                    }
                    Messaging.addMessages(
                        new Message({
                            code: sPath,
                            message: this.getModel("i18n").getResourceBundle().getText("InvalidValue", [sText, sValue]),
                            type: MessageType.Error,
                            processor: this.getModel("local")
                        })
                    );
                }.bind(this));
            }
        },

        onMoveTypeChange: function (oEvent) {
            var sSelectedKey = oEvent.getSource().getSelectedKey();
            if (sSelectedKey === "1") { // One Step
                this.getModel("local").setProperty("/NG_Header/LocationTo2", "");
                this.getModel("local").setProperty("/NG_Header/LocationTo2Name", "");
                this.byId("idLocationTo2Text").setVisible(true);
                this.byId("idLocationTo2Input").setVisible(false);
                this.byId("idLocationTo2Label").setRequired(false);
                this.byId("idLocationTo2Input").setRequired(false);
            } else if (sSelectedKey === "2") { // Two Step
                this.byId("idLocationTo2Text").setVisible(false);
                this.byId("idLocationTo2Input").setVisible(true);
                this.byId("idLocationTo2Label").setRequired(true);
                this.byId("idLocationTo2Input").setRequired(true);
            }
        },

        handleSuggest: function (oEvent) {
            var aFilters = [];
            var oBinding = oEvent.getSource().getBinding("suggestionRows");
            var sPlant = this.getModel("local").getProperty("/NG_Header/Plant");
            aFilters.push(new sap.ui.model.Filter("Plant", FilterOperator.EQ, sPlant));
            oBinding.filter(aFilters);
        },

        rowSelectionChange: function (oEvent) {
            var bEnabled = true;
            var aSelectedIndices = oEvent.getSource().getSelectedIndices();
            if (aSelectedIndices.length > 0) {
                var aNG_Item = this.getModel("local").getProperty("/NG_Header/to_NG_Item/results");
                aSelectedIndices.forEach((index) => {
                    if (aNG_Item[index].DeleteFlag === "X" || aNG_Item[index].Move1PostStatus === "P") {
                        bEnabled = false;
                    }
                });
            }
            this.getModel("local").setProperty("/Control/enabled", bEnabled);
        },

        onNG_Item: function (oEvent, sEvent) {
            var sNG_No = this.getModel("local").getProperty("/NG_No");
            var aNG_Item = this.getModel("local").getProperty("/NG_Header/to_NG_Item/results");
            if (sEvent === "ADD") {
                var item = {
                    NG_No: sNG_No,
                    NG_ItemNo: "",
                    Material: "",
                    MaterialName: "",
                    Quantity: "",
                    BaseUnit: "PC",
                    ProductionOrder: "",
                    Customer: "",
                    CustomerName: "",
                    FoundDate: null,
                    Assembly: "",
                    WorkCenter: "",
                    NG_Position: "",
                    Shift: "",
                    Symptom: "",
                    CounterMeasure: "",
                    RootCause: "",
                    Factor: "",
                    Move1PostStatus: "",
                    IQC_NG_Quantity: "",
                    IQC_OK_Quantity: "",
                    IQC_ApprovedBy: "",
                    IQC_Remark: "",
                    IQC_PostStatus: ""
                };
                aNG_Item.push(item);
                aNG_Item.forEach((line, index) => {
                    line.NG_ItemNo = index + 1;
                });
                this.getModel("local").setProperty("/NG_Header/to_NG_Item/results", aNG_Item);
                this.getModel("local").setProperty("/ItemEdit", aNG_Item[aNG_Item.length - 1]);
                this.showEditItemDialog();
            } else {
                var oTable = this.byId("idNG_ItemTable");
                var aSelectedIndices = oTable.getSelectedIndices();
                if (aSelectedIndices.length === 0) {
                    return;
                }
                switch (sEvent) {
                    case "COPY":
                        var newItem = {};
                        var copyItem = aNG_Item[aSelectedIndices[0]];
                        for (const key in copyItem) {
                            newItem[key] = copyItem[key];
                            newItem["BaseUnit"] = "PC";
                            if (key.includes("__metadata") &&
                                key.includes("NG_ItemNo") &&
                                key.includes("DeleteFlag") &&
                                key.includes("CreatedBy") &&
                                key.includes("CreatedAt") &&
                                key.includes("LastChangedBy") &&
                                key.includes("LastChangedAt") &&
                                key.includes("Move1") &&
                                key.includes("IQC") &&
                                key.includes("LocalLastChangedAt")) {
                                newItem[key] = "";
                            }
                        }
                        aNG_Item.push(newItem);
                        aNG_Item.forEach((line, index) => {
                            line.NG_ItemNo = index + 1;
                        });
                        this.getModel("local").setProperty("/NG_Header/to_NG_Item/results", aNG_Item);
                        this.getModel("local").setProperty("/ItemEdit", aNG_Item[aNG_Item.length - 1]);
                        this.showEditItemDialog();
                        break;

                    case "EDIT":
                        var editItem = {};
                        var selectItem = aNG_Item[aSelectedIndices[0]];
                        for (const key in selectItem) {
                            editItem[key] = selectItem[key];
                        }
                        this.getModel("local").setProperty("/ItemEdit", editItem);
                        this.showEditItemDialog();
                        break;

                    case "DELETE":
                        var iLen = aSelectedIndices.length - 1;
                        do {
                            if (aNG_Item[aSelectedIndices[iLen]]["ItemCreatedBy"]) {
                                // 数据库数据，先打删除标记
                                aNG_Item[aSelectedIndices[iLen]]["DeleteFlag"] = "X";
                                aNG_Item[aSelectedIndices[iLen]]["DeleteFlagButton"] = "sap-icon://delete";
                            } else {
                                // 非数据库数据，直接删除
                                aNG_Item.splice(aSelectedIndices[iLen], 1);
                            }
                            iLen--;
                        } while (iLen >= 0);
                        this.getModel("local").setProperty("/NG_Header/to_NG_Item/results", aNG_Item);
                    default:
                        break;
                }
            }
        },

        onNG_ItemIQC: function (oEvent, sEvent) {
            var oTable = this.byId("idNG_Item_IQCTable");
            var aSelectedIndices = oTable.getSelectedIndices();
            var aNG_Item = this.getModel("local").getProperty("/NG_Header/to_NG_Item/results");
            switch (sEvent) {
                case "CLEAR":
                    if (aSelectedIndices.length === 0) {
                        return;
                    }
                    for (var i = 0; i < aSelectedIndices.length; i++) {
                        aNG_Item.forEach((line, index) => {
                            if (index === aSelectedIndices[i] && line.DeleteFlag === "X") {
                                line.IQC_NG_Quantity = "";
                                line.IQC_OK_Quantity = "";
                                line.IQC_ApprovedBy = "";
                                line.IQC_Remark = "";
                            }
                        });
                    }
                    this.getModel("local").setProperty("/NG_Header/to_NG_Item/results", aNG_Item);
                    oTable.clearSelection();
                    break;
                default:
                    break;
            }
        },

        showEditItemDialog: function () {
            var that = this;
            var oBusyDialog = new BusyDialog();
            oBusyDialog.open();
            Fragment.load({
                name: "pp.zngmanangement.fragments.NG_ItemEdit",
                controller: this
            }).then(function (oDialog) {
                //ダイアログがロードされたら
                this._oEditItemDialog = oDialog;
                //ダイアログからモデルを使用できるようにする
                this.getView().addDependent(this._oEditItemDialog);
                this._oEditItemDialog.addButton(new sap.m.Button({
                    text: "{i18n>Save}",
                    press: function () {
                        var aNG_Item = this.getModel("local").getProperty("/NG_Header/to_NG_Item/results");
                        var editItem = this.getModel("local").getProperty("/ItemEdit");
                        for (let index = 0; index < aNG_Item.length; index++) {
                            if (aNG_Item[index].NG_ItemNo === editItem.NG_ItemNo) {
                                for (const key in editItem) {
                                    if (!key.includes("NG_ItemNo")) {
                                        aNG_Item[index][key] = editItem[key];
                                    }
                                }
                            }
                        }
                        this.getModel("local").setProperty("/NG_Header/to_NG_Item/results", aNG_Item);
                        this.getParent().destroy();
                    }
                }));
                this._oEditItemDialog.addButton(new sap.m.Button({
                    text: "{i18n>Cancel}",
                    press: function () {
                        that._oEditItemDialog.destroy();
                    }
                }));
                oBusyDialog.close();
                this._oEditItemDialog.open();
            }.bind(this));
        },

        onDatePickerChange: function (oEvent) {
            var oDatePicker = oEvent.getSource();
            var bValid = oEvent.getParameter("valid");
            if (bValid) {
                oDatePicker.setValueState("None");
            } else {
                oDatePicker.setValueState("Error");
                return;
            }
            if (oDatePicker.mBindingInfos && oDatePicker.mBindingInfos.value && oDatePicker.mBindingInfos.value.parts.length > 0) {
                var oDataValue = oDatePicker.getProperty("dateValue");
                var sPath = oDatePicker.mBindingInfos.value.parts[0].path;
                this.getModel("local").setProperty(sPath, oDataValue);
            }
        },

        onPressFunction: function (sEvent) {
            Messaging.removeAllMessages();
            var that = this;
            var sMsg = "";
            var oNG_Data = this.getModel("local").getProperty("/NG_Header");;
            if (sEvent === "Save") {
                sMsg = this.getModel("i18n").getResourceBundle().getText(sEvent);
                if (this._checkRequiredFields()) {
                    Messaging.addMessages(
                        new Message({
                            message: this.getModel("i18n").getResourceBundle().getText("CheckRequired"),
                            type: MessageType.Error,
                            processor: this.getModel("local")
                        })
                    );
                    return;
                }
                if (oNG_Data.to_NG_Item.results.length === 0) {
                    Messaging.addMessages(
                        new Message({
                            message: this.getModel("i18n").getResourceBundle().getText("AtLeastOneItem"),
                            type: MessageType.Error,
                            processor: this.getModel("local")
                        })
                    );
                    return;
                }
            } else if (sEvent === "DeleteNG") {
                sMsg = this.getModel("i18n").getResourceBundle().getText(sEvent, [oNG_Data.NG_No]);
                // editing
                if (this.getModel("local").getProperty("/Control/showFooter")) {
                    Messaging.addMessages(
                        new Message({
                            message: this.getModel("i18n").getResourceBundle().getText("EditingStatus"),
                            type: MessageType.Error,
                            processor: this.getModel("local")
                        })
                    );
                    return;
                }
                return;
            }
            oNG_Data["UserEmail"] = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            MessageBox.confirm(this.getModel("i18n").getResourceBundle().getText("confirmMessage", [sMsg]), {
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        that._CallODataV2("ACTION", "/processLogic", [], {
                            "Event": sEvent.toUpperCase(),
                            "Zzkey": JSON.stringify(oNG_Data),
                            "RecordUUID": ""
                        }, {}).then(function (oResponse) {
                            var result = JSON.parse(oResponse.processLogic.Zzkey);
                            result.MESSAGEITEMS.forEach(element => {
                                Messaging.addMessages(
                                    new Message({
                                        type: element.TYPE,
                                        message: element.DESCRIPTION
                                    })
                                );
                            });
                            if (result.MESSAGEITEMS.length === 1 && result.MESSAGEITEMS[0].TYPE === "Success") {
                                that._afterModifySuccess(sEvent, result);
                            }
                        }.bind(that), function (oError) {
                            MessageBox.error(oError);
                        }.bind(that));
                    }
                },
                dependentOn: this.getView()
            });
        },

        _checkRequiredFields: function () {
            var bHasError = false;
            var oForm = this.byId("idNG_Header_SF");



            return bHasError;
        },

        async onMessagePopoverPress(oEvent) {
            const oSourceControl = oEvent.getSource();
            const oMessagePopover = await this._getMessagePopover();
            oMessagePopover.openBy(oSourceControl);
        },

        _getMessagePopover() {
            if (!this.MessageDialog) {
                this.MessageDialog = this.loadFragment({
                    name: "pp.zngmanangement.fragments.MessagePopover"
                });
            }
            return this.MessageDialog;
        },

        _resetControlState: function () {
            var oControl = this.byId("idNG_Header_SF");
            Messaging.removeAllMessages();
            oControl._aElements.forEach(function (oInnerControl) {
                var sElementId = oInnerControl.getId();
                if (sElementId.includes('input')) {
                    if (oInnerControl.setValueState && oInnerControl.setValueStateText) {
                        oInnerControl.setValueState("None");
                        oInnerControl.setValueStateText("");
                    }
                }
            });
        },

        _afterModifySuccess: function (sEvent, oResult) {
            // Display
            this._Operation = "Display";
            var oMainBusyDialog = new BusyDialog();
            oMainBusyDialog.open();
            // Update web url
            var sURL = window.location.href;
            var sNewURL = sURL.replace("INITIAL", oResult.NG_NO);
            window.history.replaceState(null, null, sNewURL);
            this.getModel("local").setProperty("/NG_No", oResult.NG_NO);
            this.byId("idNG_ItemTable").clearSelection();
            this.byId("idNG_Item_IQCTable").clearSelection();
            this._refreshData(oMainBusyDialog);
            // Display View Control
            if (sEvent === "Save") {
                this.byId("idButtonEdit").setVisible(true);
                this.byId("idButtonDelete").setVisible(true);
                this.byId("idMoveType").setEditable(false);
                this.byId("idMaterialType").setEditable(false);
                this.byId("idLocationFromText").setVisible(true);
                this.byId("idLocationFromInput").setVisible(false);
                this.byId("idLocationTo1Text").setVisible(true);
                this.byId("idLocationTo1Input").setVisible(false);
                this.byId("idLocationTo2Text").setVisible(true);
                this.byId("idLocationTo2Input").setVisible(false);
            } else if (sEvent === "DeleteNG") {
                this.byId("idButtonEdit").setVisible(false);
                this.byId("idButtonDelete").setVisible(false);
            }
            this.getModel("local").setProperty("/Control/editable", false);
            this.getModel("local").setProperty("/Control/showFooter", false);
            this.getModel("local").setProperty("/Operation", this._Operation);
        },

        _refreshData: function (oMainBusyDialog) {
            var sNG_No = this.getModel("local").getProperty("/NG_No");
            var sPath = "/" + this.getModel().createKey("NG_Header", { NG_No: sNG_No });
            this._CallODataV2("READ", sPath, [], { $expand: "to_NG_Item" }, {}).then(function (oResponse) {
                oResponse.to_NG_Item.results.sort(function (a, b) {
                    return a.NG_ItemNo - b.NG_ItemNo;
                });
                this.getModel("local").setProperty("/NG_Header", oResponse);

                var obj = oResponse.to_NG_Item.results.find(element => element.Move1PostStatus === 'P');
                if (obj) {
                    this.getModel("local").setProperty("/Control/itemNotPosted", false);
                } else {
                    this.getModel("local").setProperty("/Control/itemNotPosted", true);
                }
                if (this.byId("idNG_ItemTable")) {
                    this.byId("idNG_ItemTable").clearSelection();
                }
                if (this.byId("idNG_Item_IQCTable")) {
                    this.byId("idNG_Item_IQCTable").clearSelection();
                }

                this.byId("idMessageStrip").setVisible(oResponse.DeleteFlag === "X" ? true : false);
                this.byId("idButtonEdit").setVisible(oResponse.DeleteFlag === "");
                this.byId("idButtonDelete").setVisible(oResponse.DeleteFlag === "");
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
