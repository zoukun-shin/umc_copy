/* global XLSX:true */
sap.ui.define([
    "./Base",
    "../lib/exceljs.min",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/m/Dialog",
    "sap/m/RadioButtonGroup",
    "sap/m/RadioButton",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/library",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Base, xlsx, BusyDialog, MessageBox, MessageToast, Fragment, Dialog, RadioButtonGroup, RadioButton, Button, Label, Input, library, Filter, FilterOperator) => {
    "use strict";

    var ButtonType = library.ButtonType;
    // 通用样式与边框定义
    const fontHeaderTitle = { name: "Arial", size: 12, bold: true };
    const fontHeaderSub = { name: "Arial", size: 10 };
    const fontDocTitle = { name: "Arial", size: 14, bold: true, underline: true };
    const fontLabel = { name: "Arial", size: 9, bold: true };
    const fontValue = { name: "Arial", size: 9 };
    const borderThin = {
        top: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } }
    };
    const borderThinBottom = {
        bottom: { style: "thin", color: { argb: "000000" } }
    };
    const alignCenter = { vertical: "middle", horizontal: "center", wrapText: true };
    const alignLeft = { vertical: "middle", horizontal: "left", wrapText: true };
    const alignTopLeft = { vertical: "top", horizontal: "left", wrapText: true };

    return Base.extend("sd.zshippinginstruction.controller.Main", {

        onInit() {
            this._myBusyDialog = new BusyDialog();
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-View"),
                        Maintain: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Maintain"),
                        Delete: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Delete"),
                        Print: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Print"),
                        Export: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Export"),
                        LoadDelivery: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-LoadDelivery"),
                        WritePackageStructure: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-WritePackageStructure"),
                        Recalculate: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Recalculate"),
                        Approve: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Approve"),
                        CancelApproval: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-CancelApproval"),
                        SplitLine: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-SplitLine"),
                        ResetLine: aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-ResetLine")
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

        onRowSelectionChange: function () {
            var bEnabled = true;
            var oReportTable = this.byId("idStandardListTable");
            var aSelectedIndices = oReportTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                this.getModel("local").setProperty("/RptButtonEnabled", true);
                return;
            }
            for (var index = 0; index < aSelectedIndices.length; index++) {
                var sPath = oReportTable.getContextByIndex(aSelectedIndices[index]).getPath();
                var oSelectedRow = this.getModel().getObject(sPath);
                if (!oSelectedRow.IsExists) {
                    bEnabled = false;
                }
            }
            this.getModel("local").setProperty("/RptButtonEnabled", bEnabled);
        },

        onPressAction: function (sAction) {
            var aOutputOptions = [
                new RadioButton({ text: "{i18n>Option1}" }),
                new RadioButton({ text: "{i18n>Option2}" }),
                new RadioButton({ text: "{i18n>Option3}" }),
                new RadioButton({ text: "{i18n>Option4}" })
            ];
            switch (sAction) {
                case "Maintain":
                    this._maintain();
                    break;
                case "Delete":
                    this._delete();
                    break;
                case "Print":
                    this._output(sAction, "PDF", aOutputOptions);
                    break;
                case "Export":
                    this._output(sAction, "Excel", aOutputOptions);
                    break;
                case "LoadDelivery":
                    this._loadDelivery();
                    break;
                case "WritePackageStructure":
                    this._writePackageStructure();
                    break;
                case "Recalculate":
                    this._recalculate();
                    break;
                case "Approve":
                    this._approve();
                    break;
                case "CancelApproval":
                    this._cancelApproval();
                    break;
                case "SplitLine":
                    this._splitLine();
                    break;
                case "ResetLine":
                    this._resetLine();
                    break;
                default:
                    break;
            }
        },

        _maintain: function () {
            var oReportTable = this.byId("idStandardListTable");
            var aSelectedIndices = oReportTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                MessageBox.error(this.getResourceBundle().getText("NoneSelected"));
                return;
            } else if (aSelectedIndices.length > 1) {
                MessageBox.error(this.getResourceBundle().getText("AllowSelectOne"));
                return;
            }
            var sPath = oReportTable.getContextByIndex(aSelectedIndices[0]).getPath();
            var oSelectedRow = this.getModel().getObject(sPath);
            this._openMaintainDialog(oSelectedRow);
        },

        _delete: function () {
            var bHasApproved = false;
            var aSelectedRows = [];
            var oReportTable = this.byId("idStandardListTable");
            var aSelectedIndices = oReportTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                MessageBox.error(this.getResourceBundle().getText("NoneSelected"));
                return;
            }
            for (var index = 0; index < aSelectedIndices.length; index++) {
                var sPath = oReportTable.getContextByIndex(aSelectedIndices[index]).getPath();
                var oSelectedRow = this.getModel().getObject(sPath);
                aSelectedRows.push({
                    BillingDocument: oSelectedRow.BillingDocument
                });
                if (oSelectedRow.IsApproved) {
                    bHasApproved = true;
                }
            }
            if (bHasApproved) {
                MessageBox.error(this.getResourceBundle().getText("NoDeleteApproved"));
                return;
            }
            this.showConfirmDialog(this.getResourceBundle().getText("ConfirmTitle", [this.getResourceBundle().getText("Delete")]), function () {
                this._CallODataV2("ACTION", "/processLogic", [], {
                    "Event": "DELETE",
                    "Zzkey": JSON.stringify({
                        item: {
                            DeliverySet: aSelectedRows
                        }
                    }),
                    "RecordUUID": ""
                }, {}).then(function (res) {
                    var oParsedZzkey = this.convJsonKeys2Metadata(res.processLogic.Zzkey);
                    if (oParsedZzkey.haserror) {
                        MessageToast.show(this.getResourceBundle().getText("ProcessError"));
                    } else {
                        MessageToast.show(this.getResourceBundle().getText("ProcessSuccess"));
                        this.getModel().refresh();
                    }
                }.bind(this));
            }.bind(this));
        },

        _output: function (sAction, sFileType, aOutputOptions) {
            var oReportTable = this.byId("idStandardListTable");
            var aSelectedRows = [];
            var aSelectedIndices = oReportTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                MessageBox.error(this.getResourceBundle().getText("NoneSelected"));
                return;
            }
            for (var index = 0; index < aSelectedIndices.length; index++) {
                var sPath = oReportTable.getContextByIndex(aSelectedIndices[index]).getPath();
                var oSelectedRow = this.getModel().getObject(sPath);
                aSelectedRows.push({
                    BillingDocument: oSelectedRow.BillingDocument
                });
            }
            this._openOutputDialog(sAction, sFileType, aOutputOptions, aSelectedRows);
        },

        // 加载交货单
        _loadDelivery: function () {
            var aPromises = [];
            var oHeader = this.getModel("local").getProperty("/Header");
            var aDeliverySet = this.getModel("local").getProperty("/Item/DeliverySet");
            var aFilters = [
                new Filter("SalesOrganization", FilterOperator.EQ, oHeader.SalesOrganization),
                new Filter("ShippingPoint", FilterOperator.EQ, oHeader.ShippingPoint),
                new Filter("ShipToParty", FilterOperator.EQ, oHeader.ShipToParty.padStart(10, '0'))
            ];
            if (aDeliverySet.length > 0) {
                aFilters.push(new Filter("Plant", FilterOperator.EQ, aDeliverySet[0].Plant));
            }
            aPromises.push(this._CallODataV2("READ", "/ZC_ShippingInstrLoadDelivery", aFilters, {
                "$expand": "to_LoadDelivItem"
            }, {}));
            Promise.all(aPromises).then(function (res) {
                if (res[0] && res[0].results) {
                    this.getModel("local").setProperty("/LoadDelivery", res[0].results);
                }
                Fragment.load({
                    name: "sd.zshippinginstruction.fragments.LoadDelivery",
                    controller: this
                }).then(function (oDialog) {
                    this._oLoadDeliveryDialog = oDialog;
                    this.getView().addDependent(this._oLoadDeliveryDialog);
                    this.getView().setModel(this.getModel("local"), "local");
                    this._oLoadDeliveryDialog.addButton(new Button({
                        text: "{i18n>Confirm}",
                        type: ButtonType.Emphasized,
                        press: function (oEvent) {
                            this.showWarningDialog(this.getResourceBundle().getText("ConfirmLoadDelivery"), function () {
                                var aSelectedIndices = sap.ui.getCore().byId("idLoadDeliveryTable").getSelectedIndices();
                                if (aSelectedIndices.length === 0) {
                                    MessageBox.error(this.getResourceBundle().getText("NoneSelected"));
                                    return;
                                }
                                var aExistingDeliverySet = this.getModel("local").getProperty("/Item/DeliverySet");
                                var iSerialNumber = aExistingDeliverySet.length;
                                for (var i = 0; i < aSelectedIndices.length; i++) {
                                    var oSelectedItem = this.getModel("local").getProperty("/LoadDelivery/" + aSelectedIndices[i]);
                                    if (!aExistingDeliverySet.some(item => item.OutboundDelivery === oSelectedItem.OutboundDelivery)) {
                                        var aLoadDelivItem = oSelectedItem.to_LoadDelivItem.results;
                                        var oErrorItem = aLoadDelivItem.find(item => Number(item.PerBoxTargetQty) === 0);
                                        if (oErrorItem) {
                                            MessageBox.error(this.getResourceBundle().getText("NoPackagedData", [oErrorItem.OutboundDelivery]));
                                            return;
                                        }
                                        aExistingDeliverySet.push(...aLoadDelivItem.map(item => ({
                                            ...item,
                                            SerialNumber: ++iSerialNumber,
                                            BoxMeasureSize: item.Length + "*" + item.Width + "*" + item.Height,
                                        })));
                                    }
                                }
                                this.getModel("local").setProperty("/Item/DeliverySet", aExistingDeliverySet);
                                // 写入包装结构
                                this._writePackageStructure();
                                // 重新计算
                                this._recalculate();
                                this.getModel("local").setProperty("/LoadDelivery", []);
                                this._oLoadDeliveryDialog.destroy();
                            }.bind(this));
                        }.bind(this)
                    }));
                    this._oLoadDeliveryDialog.addButton(new Button({
                        text: "{i18n>Cancel}",
                        press: function () {
                            this.getModel("local").setProperty("/LoadDelivery", []);
                            this._oLoadDeliveryDialog.destroy();
                        }.bind(this)
                    }));
                    this._oLoadDeliveryDialog.open();
                }.bind(this));
            }.bind(this)).catch(function (error) {
                MessageBox.error(error);
            }.bind(this));
        },

        // 写入包装结构
        _writePackageStructure: function () {
            var aPromises = [];
            var oHeader = this.getModel("local").getProperty("/Header");
            var aDeliverySet = this.getModel("local").getProperty("/Item/DeliverySet") || [];
            aPromises.push(this._CallODataV2("ACTION", "/processLogic", [], {
                "Event": "WRITE",
                "Zzkey": JSON.stringify({
                    header: oHeader,
                    item: {
                        DeliverySet: aDeliverySet,
                    }
                }),
                "RecordUUID": ""
            }, {}));
            Promise.all(aPromises).then(function (res) {
                if (res[0] && res[0].processLogic) {
                    var oResult = this.convJsonKeys2Metadata(res[0].processLogic.Zzkey);
                    if (oResult && oResult.Header) {
                        oResult.Header.RequestedDeliveryDate = oResult.Header.RequestedDeliveryDate === "" ? null : new Date(oResult.Header.RequestedDeliveryDate);
                        oResult.Header.PlannedGoodsIssueDate = oResult.Header.PlannedGoodsIssueDate === "" ? null : new Date(oResult.Header.PlannedGoodsIssueDate);
                        oResult.Header.PlannedGoodsMovementDate = oResult.Header.PlannedGoodsMovementDate === "" ? null : new Date(oResult.Header.PlannedGoodsMovementDate);
                        oResult.Header.PlannedCustomsDeclarationDate = oResult.Header.PlannedCustomsDeclarationDate === "" ? null : new Date(oResult.Header.PlannedCustomsDeclarationDate);
                        oResult.Header.ApprovalDate = oResult.Header.ApprovalDate === "" ? null : new Date(oResult.Header.ApprovalDate);
                        oResult.Header.IsApproved = oResult.Header.IsApproved === "X" ? true : false;
                        oResult.Header.IsExists = oResult.Header.IsExists === "X" ? true : false;
                    }
                    this.getModel("local").setProperty("/Header", oResult.Header);
                    this.getModel("local").setProperty("/Item", oResult.Item);
                }
                MessageToast.show(this.getResourceBundle().getText("WritePackageStructureSuccess"));
            }.bind(this)).catch(function (error) {
                MessageBox.error(error);
            }.bind(this));
        },

        // 重新计算
        _recalculate: function () {
            var iCurrentBox, iSerialNumber = 0;
            var iCurrentBoxNumber = parseInt(this.getModel("local").getProperty("/Header/StartBoxNumber"));
            var aDeliverySet = this.getModel("local").getProperty("/Item/DeliverySet") || [];
            var aPackingBoxSet = this.getModel("local").getProperty("/Item/PackingBoxSet") || [];

            if (isNaN(iCurrentBoxNumber) || iCurrentBoxNumber < 1) {
                iCurrentBoxNumber = 1;
            }

            iCurrentBox = iCurrentBoxNumber;
            aDeliverySet.forEach(function (oDeliveryItem) {
                var iStartBox = iCurrentBox;
                var iEndBox;

                if (oDeliveryItem.BoxQty === 1) {
                    iEndBox = iStartBox;
                } else {
                    iEndBox = iCurrentBox + oDeliveryItem.BoxQty - 1;
                }
                oDeliveryItem.BeginBoxNo = iStartBox;
                oDeliveryItem.EndBoxNo = iEndBox;
                oDeliveryItem.BoxNumberRange = iStartBox + "-" + iEndBox;
                oDeliveryItem.SerialNumber = ++iSerialNumber;

                iCurrentBox = iEndBox + 1;
            });

            iCurrentBox = iCurrentBoxNumber;
            aPackingBoxSet.forEach(function (oPackingBoxItem) {
                var iStartBox = iCurrentBox;
                var iEndBox;

                if (oPackingBoxItem.BoxQty === 1) {
                    iEndBox = iStartBox;
                } else {
                    iEndBox = iCurrentBox + oPackingBoxItem.BoxQty - 1;
                }
                oPackingBoxItem.BeginBoxNo = iStartBox;
                oPackingBoxItem.EndBoxNo = iEndBox;
                oPackingBoxItem.BoxNumberRange = iStartBox + "-" + iEndBox;
                oPackingBoxItem.SerialNumber = ++iSerialNumber;

                iCurrentBox = iEndBox + 1;
            });

            this.getModel("local").setProperty("/Item/DeliverySet", aDeliverySet);
            this.getModel("local").setProperty("/Item/PackingBoxSet", aPackingBoxSet);
        },

        // 审核
        _approve: function () {
            var sTitle = this.getResourceBundle().getText("ApproveDialogTitle");
            this._openApproveDialog(sTitle);
        },

        // 取消审核
        _cancelApproval: function () {
            var sTitle = this.getResourceBundle().getText("CancelApproveDialogTitle");
            this._openApproveDialog(sTitle);
        },

        // 拆分行
        _splitLine: function () {
            var oDeliveryTable = sap.ui.getCore().byId("idTable_Delivery");
            var aSelectedIndices = oDeliveryTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                MessageBox.error(this.getResourceBundle().getText("NoneSelected"));
                return;
            } else if (aSelectedIndices.length > 1) {
                MessageBox.error(this.getResourceBundle().getText("AllowSelectOne"));
                return;
            }
            var oSelectedPath = "/Item/DeliverySet/" + aSelectedIndices[0];
            this._openSplitDialog(oSelectedPath);
        },

        // 重置行
        _resetLine: function () {
            var oDeliveryTable = sap.ui.getCore().byId("idTable_Delivery");
            var aSelectedIndices = oDeliveryTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                MessageBox.error(this.getResourceBundle().getText("NoneSelected"));
                return;
            }
            this.showWarningDialog(this.getResourceBundle().getText("ConfirmResetLine"), function () {
                var oItem = this.getModel("local").getProperty("/Item");
                oItem.DeliverySet = this._mergeArrayBySelectedKeys(oItem.DeliverySet, aSelectedIndices, oDeliveryTable, ["OutboundDelivery", "OutboundDeliveryItem"], "ActualDeliveryQuantity");
                this.getModel("local").setProperty("/Item", oItem);
                // 写入包装结构
                this._writePackageStructure();
                // 重新计算
                this._recalculate();
            }.bind(this));
        },

        _save: function () {
            var oHeader = this.getModel("local").getProperty("/Header");
            var oItem = this.getModel("local").getProperty("/Item");
            this._CallODataV2("ACTION", "/processLogic", [], {
                "Event": "SAVE",
                "Zzkey": JSON.stringify({
                    header: oHeader,
                    item: oItem,
                    useremail: "xinlei.xu@sh.shin-china.com",//this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail(),
                    username: "XINLEI XU"//this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName()
                }),
                "RecordUUID": ""
            }, {}).then(function (res) {
                this._myBusyDialog.open();
                var oParsedZzkey = this.convJsonKeys2Metadata(res.processLogic.Zzkey);
                if (oParsedZzkey.haserror) {
                    MessageToast.show(this.getResourceBundle().getText("ProcessError"));
                } else {
                    MessageToast.show(this.getResourceBundle().getText("ProcessSuccess"));
                    this.getModel("local").setProperty("/Header/IsExists", true);
                    this.getModel().refresh();
                }
                this._myBusyDialog.close();
            }.bind(this));
        },

        _openMaintainDialog: function (oClickedRow) {
            this._loadLatestPackingData(oClickedRow, () => {
                Fragment.load({
                    name: "sd.zshippinginstruction.fragments.Maintain",
                    controller: this
                }).then(function (oDialog) {
                    this._oMaintainDialog = oDialog;
                    this.getView().addDependent(this._oMaintainDialog);
                    this.getView().setModel(this.getModel("local"), "local");
                    this._oMaintainDialog.addButton(new Button({
                        text: "{i18n>Save}",
                        type: ButtonType.Emphasized,
                        enabled: "{= !${local>/Header/IsApproved}}",
                        press: function () {
                            this.showConfirmDialog(this.getResourceBundle().getText("ConfirmTitle", [this.getResourceBundle().getText("Save")]), function () {
                                this._save();
                            }.bind(this))
                        }.bind(this)
                    }));
                    this._oMaintainDialog.addButton(new Button({
                        text: "{i18n>Cancel}",
                        press: function () {
                            this._loadLatestPackingData(); // Clear data
                            this._oMaintainDialog.destroy();
                        }.bind(this)
                    }));
                    this._oMaintainDialog.open();
                }.bind(this));
            });
        },

        _openSplitDialog: function (oSplitPath) {
            var oSplitQuantityInput = new Input({
                width: "100%",
                maxLength: 15,
                liveChange: function (oEvent) {
                    this.onLiveChangePositiveDecimal(oEvent);
                    var sValue = oEvent.getParameter("newValue").trim();
                    if (sValue.length > 0) {
                        this.getModel("local").setProperty("/SplitConfirmEnabled", true);
                    } else {
                        this.getModel("local").setProperty("/SplitConfirmEnabled", false);
                    }
                }.bind(this)
            });
            this._oSplitDialog = new Dialog({
                title: "{i18n>SplitDialogTitle}",
                type: "Message",
                contentWidth: "400px",
                content: [oSplitQuantityInput],
                beginButton: new Button({
                    text: "{i18n>Confirm}",
                    type: "Emphasized",
                    enabled: "{local>/SplitConfirmEnabled}",
                    press: function () {
                        var oSplitRow = this.getModel("local").getProperty(oSplitPath);
                        var fOriginalQuantity = parseFloat(oSplitRow.ActualDeliveryQuantity);
                        var fSplitQuantity = parseFloat(oSplitQuantityInput.getValue().trim());
                        if (fSplitQuantity >= fOriginalQuantity) {
                            MessageBox.error(this.getResourceBundle().getText("SplitQuantityExceed", [fOriginalQuantity]));
                            return;
                        }

                        var oFloatFormat = sap.ui.core.format.NumberFormat.getFloatInstance({
                            maxFractionDigits: 3
                        });
                        var aDeliverySet = this.getModel("local").getProperty("/Item/DeliverySet") || [];
                        // 动作1：更新原勾选行的数量 = 原数量 - 拆分数量
                        var fNewOriginalQty = oFloatFormat.format(fOriginalQuantity - fSplitQuantity);
                        this.getModel("local").setProperty(oSplitPath + "/ActualDeliveryQuantity", fNewOriginalQty);
                        // 动作2：克隆一个新行，数量设为拆分数量，并塞回数组
                        var oNewRow = jQuery.extend(true, {}, oSplitRow);
                        oNewRow.ActualDeliveryQuantity = fSplitQuantity;
                        aDeliverySet.push(oNewRow);
                        this.getModel("local").setProperty("/Item/DeliverySet", aDeliverySet);

                        // 写入包装结构
                        this._writePackageStructure();
                        // 重新计算
                        this._recalculate();

                        oSplitQuantityInput.setValue("");
                        this._oSplitDialog.destroy();
                    }.bind(this)
                }),
                endButton: new Button({
                    text: "{i18n>Cancel}",
                    press: function () {
                        oSplitQuantityInput.setValue("");
                        this._oSplitDialog.destroy();
                    }.bind(this)
                })
            });
            this.getView().addDependent(this._oSplitDialog);
            this._oSplitDialog.open();
        },

        _openApproveDialog: function (sTitle) {
            var oApproverInput = new Input({
                width: "100%",
                maxLength: 50,
                liveChange: function (oEvent) {
                    var sValue = oEvent.getParameter("newValue").trim();
                    if (sValue.length > 0) {
                        this.getModel("local").setProperty("/ApproveConfirmEnabled", true);
                    } else {
                        this.getModel("local").setProperty("/ApproveConfirmEnabled", false);
                    }
                }.bind(this)
            });
            this._oApproveDialog = new Dialog({
                title: sTitle,
                type: "Message",
                contentWidth: "400px",
                content: [oApproverInput],
                beginButton: new Button({
                    text: "{i18n>Confirm}",
                    type: "Emphasized",
                    enabled: "{local>/ApproveConfirmEnabled}",
                    press: function () {
                        var sApproverText = oApproverInput.getValue().trim();
                        this.getModel("local").setProperty("/Header/IsApproved", !this.getModel("local").getProperty("/Header/IsApproved"));
                        this.getModel("local").setProperty("/Header/ApproverName", sApproverText);
                        this._CallODataV2("ACTION", "/processLogic", [], {
                            "Event": "APPROVE",
                            "Zzkey": JSON.stringify({
                                header: this.getModel("local").getProperty("/Header"),
                                item: this.getModel("local").getProperty("/Item"),
                                useremail: "xinlei.xu@sh.shin-china.com",//this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail(),
                                username: "XINLEI XU"//this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName()
                            }),
                            "RecordUUID": ""
                        }, {}).then(function (res) {
                            var oParsedZzkey = this.convJsonKeys2Metadata(res.processLogic.Zzkey);
                            oParsedZzkey.Header['IsExists'] = true;
                            this._loadLatestPackingData(oParsedZzkey.Header, function () {
                                if (oParsedZzkey.haserror) {
                                    MessageToast.show(this.getResourceBundle().getText("ProcessError"));
                                } else {
                                    MessageToast.show(this.getResourceBundle().getText("ProcessSuccess"));
                                }
                                oApproverInput.setValue("");
                                this.getModel("local").setProperty("/ApproveConfirmEnabled", false);
                                this._oApproveDialog.destroy();
                            }.bind(this));
                        }.bind(this));
                    }.bind(this)
                }),
                endButton: new Button({
                    text: "{i18n>Cancel}",
                    press: function () {
                        oApproverInput.setValue("");
                        this.getModel("local").setProperty("/ApproveConfirmEnabled", false);
                        this._oApproveDialog.destroy();
                    }.bind(this)
                })
            });
            this.getView().addDependent(this._oApproveDialog);
            this._oApproveDialog.open();
        },

        _loadLatestPackingData: function (oClickedRow, fnSuccessCallback) {
            var sRequest = "";
            var aPromises = [];
            if (oClickedRow) {
                if (oClickedRow.IsExists) {
                    sRequest = "ZTABLE";
                    aPromises.push(this._CallODataV2("READ", "/ZC_ShippingInstructionHeader('" + oClickedRow.BillingDocument + "')", [], {
                        "$expand": "to_ShippingInstructionDelivery,to_ShippingInstructionBox,to_ShippingInstructionPallet"
                    }, {}));
                } else {
                    sRequest = "REPORT";
                    aPromises.push(this._CallODataV2("READ", "/ShipgInstrReport", [
                        new Filter("BillingDocument", FilterOperator.EQ, oClickedRow.BillingDocument),
                        new Filter("DefaultPackingItem", FilterOperator.EQ, "X")
                    ], {}, {}));
                }
            }
            Promise.all(aPromises).then(function (res) {
                if (sRequest === "REPORT" && res[0] && res[0].results && res[0].results[0] && res[0].results[0].DefaultPackingItem) {
                    var oItem = this.convJsonKeys2Metadata(res[0].results[0].DefaultPackingItem);
                }
                if (sRequest === "ZTABLE") {
                    oClickedRow = res[0];
                    oItem = {
                        DeliverySet: oClickedRow.to_ShippingInstructionDelivery.results,
                        PackingBoxSet: oClickedRow.to_ShippingInstructionBox.results,
                        PalletSet: oClickedRow.to_ShippingInstructionPallet.results
                    };
                }
                this.getModel("local").setProperty("/Header", {
                    BillingDocument: oClickedRow == undefined ? "" : oClickedRow.BillingDocument,
                    OutboundDelivery: oClickedRow == undefined ? "" : oClickedRow.OutboundDelivery,
                    DeliveryDocumentType: oClickedRow == undefined ? "" : oClickedRow.DeliveryDocumentType,
                    TransportType: oClickedRow == undefined ? "" : oClickedRow.TransportType,
                    SalesOrganization: oClickedRow == undefined ? "" : oClickedRow.SalesOrganization,
                    SalesOrganizationName: oClickedRow == undefined ? "" : oClickedRow.SalesOrganizationName,
                    SoldToParty: oClickedRow == undefined ? "" : oClickedRow.SoldToParty,
                    SoldToPartyName: oClickedRow == undefined ? "" : oClickedRow.SoldToPartyName,
                    ShipToParty: oClickedRow == undefined ? "" : oClickedRow.ShipToParty,
                    ShipToPartyName: oClickedRow == undefined ? "" : oClickedRow.ShipToPartyName,
                    ShippingPoint: oClickedRow == undefined ? "" : oClickedRow.ShippingPoint,
                    RequestedDeliveryDate: oClickedRow == undefined ? null : oClickedRow.RequestedDeliveryDate,
                    IncotermsClassification: oClickedRow == undefined ? "" : oClickedRow.IncotermsClassification,
                    IncotermsTransferLocation: oClickedRow == undefined ? "" : oClickedRow.IncotermsTransferLocation,
                    ShippingType: oClickedRow == undefined ? "" : oClickedRow.ShippingType,
                    PlannedGoodsIssueDate: oClickedRow == undefined ? null : oClickedRow.PlannedGoodsIssueDate,
                    PlannedGoodsMovementDate: oClickedRow == undefined ? null : oClickedRow.PlannedGoodsMovementDate,
                    PlannedCustomsDeclarationDate: oClickedRow == undefined ? null : oClickedRow.PlannedCustomsDeclarationDate,
                    ContainerNumber: oClickedRow == undefined ? "" : oClickedRow.ContainerNumber,
                    TruckNumber: oClickedRow == undefined ? "" : oClickedRow.TruckNumber,
                    Driver: oClickedRow == undefined ? "" : oClickedRow.Driver,
                    WayBill: oClickedRow == undefined ? "" : oClickedRow.WayBill,
                    IsApproved: oClickedRow == undefined ? false : (oClickedRow.IsApproved === "" ? false : true),
                    ApproverName: oClickedRow == undefined ? "" : oClickedRow.ApproverName,
                    ApprovalDate: oClickedRow == undefined ? null : oClickedRow.ApprovalDate,
                    StartBoxNumber: oClickedRow == undefined ? "" : oClickedRow.StartBoxNumber === undefined ? "1" : oClickedRow.StartBoxNumber,
                    Remarks: oClickedRow == undefined ? "" : oClickedRow.Remarks,
                    IsExists: oClickedRow == undefined ? false : (oClickedRow.IsExists === "" ? false : true)
                });
                this.getModel("local").setProperty("/Item", {
                    DeliverySet: oItem == undefined ? [] : oItem.DeliverySet,
                    PackingBoxSet: oItem == undefined ? [] : oItem.PackingBoxSet,
                    PalletSet: oItem == undefined ? [] : oItem.PalletSet
                });
                this.getModel("local").setProperty("/MaintainEditable", !this.getModel("local").getProperty("/Header/IsApproved"));
                if (fnSuccessCallback) {
                    fnSuccessCallback();
                }
            }.bind(this)).catch(function (error) {
                MessageBox.error(error);
            }.bind(this));
        },

        _openOutputDialog: function (sAction, sFileType, aOutputOptions, aSelectedRows) {
            this._myBusyDialog.open();
            var oRadioButtonGroup = new RadioButtonGroup({
                columns: 1,
                buttons: aOutputOptions
            });
            oRadioButtonGroup.addStyleClass("sapUiSmallMargin");
            this._oOutputDialog = new Dialog({
                title: this.getResourceBundle().getText("OutputOptions", [this.getResourceBundle().getText(sAction), this.getResourceBundle().getText(sFileType)]),
                content: [oRadioButtonGroup],
                beginButton: new Button({
                    text: "{i18n>Confirm}",
                    type: ButtonType.Emphasized,
                    press: function () {
                        this._OutputFile(sAction, oRadioButtonGroup.getSelectedIndex(), aSelectedRows);
                        this._oOutputDialog.destroy();
                    }.bind(this)
                }),
                endButton: new Button({
                    text: "{i18n>Cancel}",
                    press: function () {
                        this._oOutputDialog.destroy();
                    }.bind(this)
                })
            });
            this.getView().addDependent(this._oOutputDialog);
            this._oOutputDialog.open();
            this._myBusyDialog.close();
        },

        _OutputFile: function (sAction, iOutputOption, aSelectedRows) {
            var aPromises = [];
            aSelectedRows.forEach(row => {
                aPromises.push(this._CallODataV2("READ", "/ZC_ShippingInstructionHeader('" + row.BillingDocument + "')", [], {
                    "$expand": "to_ShippingInstructionDelivery,to_ShippingInstructionBox,to_ShippingInstructionPallet"
                }, {}));
            });
            Promise.all(aPromises).then(function (res) {
                switch (sAction) {
                    case "Print":
                        break;
                    case "Export":
                        res.forEach(data => {
                            this._ExportExcel(iOutputOption, data);
                        });
                        break;
                    default:
                        break;
                }
            }.bind(this)).catch(function (error) {
                MessageBox.error(error);
            }.bind(this));
        },

        _ExportExcel: async function (iOutputOption, oDataSource) {
            // 创建工作簿和工作表
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(this.getResourceBundle().getText("Option" + (iOutputOption + 1)));

            // 确保开启网格线显示
            worksheet.views = [{ showGridLines: true }];

            var sTitle = "", sLable = "";
            var colWidths = [];
            switch (iOutputOption) {
                case 0: // PL(FUJIFILM)
                    sTitle = "Transportation Order";
                    sLable = "TO No.:";
                    colWidths.push(
                        11, 12, 12, 12,     // A - D
                        14, 15, 8, 12, 12,  // E - I
                        12,                 // J
                        15, 16, 12,         // K - M
                        4,                  // N
                        14, 12, 12, 12, 12  // O - S
                    );
                    break;
                case 1: // PL(保税区)
                    sTitle = "Transportation Order";
                    sLable = "TO No.:";
                    colWidths.push(
                        11, 12, 12, 12,     // A - D
                        14, 15, 12, 12, 12, // E - I
                        12,                 // J
                        16, 14, 12,         // K - M
                        12,                 // N
                        14, 14, 12, 12, 14  // O - S
                    );
                    break;
                case 2: // PL(福保)
                    sTitle = "Invoice & PL";
                    sLable = "PL No.:";
                    colWidths.push(
                        11, 12, 12, 12,     // A - D
                        14, 15, 12, 12, 12, // E - I
                        12,                 // J
                        16, 14, 12,         // K - M
                        12,                 // N
                        14, 14, 12, 12, 14  // O - S
                    );
                    break;
                case 3: // PL(通常)
                    sTitle = "Transportation Order";
                    sLable = "TO No.:";
                    colWidths.push(
                        11, 12, 12, 12,     // A - D
                        14, 15, 12, 12, 8,  // E - I
                        8,                  // J
                        16, 12, 12,         // K - M
                        12,                 // N
                        14, 14, 14, 4, 14   // O - S
                    );
                    break;
                default:
                    break;
            }

            // 插入 Logo 图片
            var sLogoUrl = sap.ui.require.toUrl("sd/zshippinginstruction/img/logo.png");
            if (sLogoUrl) {
                try {
                    const response = await fetch(sLogoUrl);
                    const arrayBuffer = await response.arrayBuffer();
                    const imageId = workbook.addImage({
                        buffer: arrayBuffer,
                        extension: 'png',
                    });
                    // 将 Logo 放置在 A1:B5 合并区域内
                    worksheet.addImage(imageId, {
                        tl: { col: 0, row: 0 },    // 左上角: A1 (列0, 行0)
                        br: { col: 2, row: 5 },    // 右下角: E6 边缘 (不含E6)
                        editAs: 'oneCell'          // 随单元格缩放
                    });
                } catch (error) {
                    console.error("Logo not found:", error);
                }
            }

            // 填充单元格数据与样式（注意：表头调整至 C 列开始，为左上角 Logo 腾出 A1:B5）
            var cellData = [
                // Header (放在 C1:S5，左侧 A1:B5 用于放置 Logo)
                { cell: "C1", v: oDataSource.CompanyName, font: fontHeaderTitle, align: alignCenter },
                { cell: "C2", v: oDataSource.CompanyOrganizationName1, font: fontHeaderSub, align: alignCenter },
                { cell: "C3", v: oDataSource.CompanyOrganizationName2, font: fontHeaderSub, align: alignCenter },
                { cell: "C4", v: "Tel.: " + oDataSource.CompanyPhone + "   Fax: " + oDataSource.CompanyFax, font: fontHeaderSub, align: alignCenter },
                { cell: "C5", v: sTitle, font: fontDocTitle, align: alignCenter },

                // Row 6 空行

                // Row 7
                { cell: "A7", v: "Consignee:", font: fontLabel, align: alignLeft },
                { cell: "B7", v: oDataSource.SoldToPartyName, font: fontValue, align: alignLeft },
                { cell: "E7", v: "Delivery Place:", font: fontLabel, align: alignLeft },
                { cell: "F7", v: oDataSource.ShipToPartyName, font: fontValue, align: alignLeft },
                { cell: "K7", v: sLable, font: fontLabel, align: alignLeft },
                { cell: "L7", v: oDataSource.BillingDocument, font: fontValue, align: alignLeft },
                { cell: "O7", v: "Transportation:", font: fontLabel, align: alignLeft },
                { cell: "P7", v: oDataSource.TransportType, font: fontValue, align: alignLeft },

                // Row 8 & 9
                { cell: "A8", v: "ADD:", font: fontLabel, align: alignLeft },
                { cell: "B8", v: oDataSource.SoldToPartyAddress, font: fontValue, align: alignTopLeft },
                { cell: "E8", v: "ADD:", font: fontLabel, align: alignLeft },
                { cell: "F8", v: oDataSource.ShipToPartyAddress, font: fontValue, align: alignTopLeft },
                { cell: "K8", v: "Declare Date:", font: fontLabel, align: alignLeft },
                { cell: "L8", v: oDataSource.PlannedCustomsDeclarationDate, font: fontValue, align: alignLeft },
                { cell: "O8", v: "Delivery Term:", font: fontLabel, align: alignLeft },
                { cell: "P8", v: oDataSource.IncotermsClassification + " " + oDataSource.IncotermsTransferLocation, font: fontValue, align: alignLeft },
                { cell: "K9", v: "ETD Factory:", font: fontLabel, align: alignLeft },
                { cell: "L9", v: oDataSource.PlannedGoodsIssueDate, font: fontValue, align: alignLeft },
                { cell: "O9", v: "Port of Destination:", font: fontLabel, align: alignLeft },
                { cell: "P9", v: "", font: fontValue, align: alignLeft },

                // Row 10
                { cell: "K10", v: "ETA Destination:", font: fontLabel, align: alignLeft },
                { cell: "L10", v: oDataSource.PlannedGoodsMovementDate, font: fontValue, align: alignLeft },

                // Row 11
                { cell: "A11", v: "ATTN:", font: fontLabel, align: alignLeft },
                { cell: "B11", v: oDataSource.SoldToPartyContact, font: fontValue, align: alignLeft },
                { cell: "E11", v: "ATTN:", font: fontLabel, align: alignLeft },
                { cell: "F11", v: oDataSource.ShipToPartyContact, font: fontValue, align: alignLeft },
                { cell: "K11", v: "Deadline:", font: fontLabel, align: alignLeft },
                { cell: "L11", v: oDataSource.RequestedDeliveryDate, font: fontValue, align: alignLeft },

                // Row 12
                { cell: "A12", v: "TEL:", font: fontLabel, align: alignLeft },
                { cell: "B12", v: oDataSource.SoldToPartyPhone, font: fontValue, align: alignLeft },
                { cell: "E12", v: "TEL:", font: fontLabel, align: alignLeft },
                { cell: "F12", v: oDataSource.ShipToPartyPhone, font: fontValue, align: alignLeft },
                { cell: "K12", v: "Prepared Date:", font: fontLabel, align: alignLeft },
                { cell: "L12", v: oDataSource.CreatedAt, font: fontValue, align: alignLeft },

                // Row 13
                { cell: "A13", v: "FAX:", font: fontLabel, align: alignLeft },
                { cell: "B13", v: oDataSource.SoldToPartyFax, font: fontValue, align: alignLeft },
                { cell: "E13", v: "FAX:", font: fontLabel, align: alignLeft },
                { cell: "F13", v: oDataSource.ShipToPartyFax, font: fontValue, align: alignLeft }
            ];

            // 设置单元格合并（Merges）
            var mergeRanges = [
                // Header Merges
                "A1:B5",
                "C1:S1", "C2:S2", "C3:S3", "C4:S4", "C5:S5",
                "B7:D7", "F7:I7", "L7:M7", "P7:S7",
                "B8:D9", "F8:I9", "L8:M8", "P8:S8",
                "L9:M9", "P9:S9",
                "L10:M10",
                "B11:D11", "F11:I11", "L11:M11",
                "B12:D12", "F12:I12", "L12:M12",
                "B13:D13", "F13:I13"
            ];

            // 设置列宽
            colWidths.forEach((width, index) => {
                worksheet.getColumn(index + 1).width = width;
            });

            // 填充表格抬头
            this._fillTableHeader(iOutputOption, cellData, mergeRanges);
            // 填充表格内容
            this._fillTableContent(iOutputOption, cellData, mergeRanges, oDataSource, worksheet);

            // 合并单元格
            mergeRanges.forEach(range => {
                worksheet.mergeCells(range);
            });

            // 写入业务数据与特定样式
            cellData.forEach(item => {
                const cell = worksheet.getCell(item.cell);
                cell.value = item.v;
                cell.font = item.font;
                cell.alignment = item.align;
            });

            // 导出 Excel 文件
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = this.getResourceBundle().getText("Option" + (iOutputOption + 1)) + "_" + this.getCurrentDateTime() + ".xlsx";
            link.click();
            URL.revokeObjectURL(link.href);
        },

        _fillTableHeader: function (iOutputOption, cellData, mergeRanges) {
            var iHeaderRow = 15;
            cellData.push({ cell: "A" + iHeaderRow, v: "TO Line", font: fontLabel, align: alignCenter });
            cellData.push({ cell: "B" + iHeaderRow, v: "Model No.", font: fontLabel, align: alignCenter });
            cellData.push({ cell: "D" + iHeaderRow, v: "Customer Model No.", font: fontLabel, align: alignCenter });
            switch (iOutputOption) {
                case 0: // PL(FUJIFILM)
                    cellData.push({ cell: "F" + iHeaderRow, v: "PO NO.", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "G" + iHeaderRow, v: "PO Line", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "H" + iHeaderRow, v: "CTN/ NO.", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "I" + iHeaderRow, v: "TOTAL(pcs)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "J" + iHeaderRow, v: "QTY/Ctn(pcs)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "K" + iHeaderRow, v: "Net Weight/ctn(kg)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "L" + iHeaderRow, v: "Gross Weight/ctn(kg)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "M" + iHeaderRow, v: "Measurement", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "O" + iHeaderRow, v: "PALLET NO.", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "P" + iHeaderRow, v: "Net Weight(kg)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "Q" + iHeaderRow, v: "Gross Weight(kg)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "R" + iHeaderRow, v: "CTN QTY", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "S" + iHeaderRow, v: "CBM(Total CTNS)", font: fontLabel, align: alignCenter });
                    mergeRanges.push("B" + iHeaderRow + ":C" + iHeaderRow);
                    mergeRanges.push("D" + iHeaderRow + ":E" + iHeaderRow);
                    mergeRanges.push("M" + iHeaderRow + ":N" + iHeaderRow);
                    break;
                case 1: // PL(保税区)
                    cellData.push({ cell: "F" + iHeaderRow, v: "Description", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "G" + iHeaderRow, v: "HS CODE", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "H" + iHeaderRow, v: "PO NO.", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "I" + iHeaderRow, v: "PO Line", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "J" + iHeaderRow, v: "CTN NO", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "K" + iHeaderRow, v: "CTN QTY", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "L" + iHeaderRow, v: "CBM", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "M" + iHeaderRow, v: "Total Qty.", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "N" + iHeaderRow, v: "Qty/Ctn", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "O" + iHeaderRow, v: "N.W.(KG/CTN)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "P" + iHeaderRow, v: "G.W.(KG/CTN)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "Q" + iHeaderRow, v: "Unit Price(USD)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "R" + iHeaderRow, v: "Total Price(USD)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "S" + iHeaderRow, v: "Measurement", font: fontLabel, align: alignCenter });
                    mergeRanges.push("B" + iHeaderRow + ":C" + iHeaderRow);
                    mergeRanges.push("D" + iHeaderRow + ":E" + iHeaderRow);
                    break;
                case 2: // PL(福保)
                    cellData.push({ cell: "F" + iHeaderRow, v: "Description", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "G" + iHeaderRow, v: "HS CODE", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "H" + iHeaderRow, v: "PO NO.", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "I" + iHeaderRow, v: "PO Line", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "J" + iHeaderRow, v: "CTN NO", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "K" + iHeaderRow, v: "CTN QTY", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "L" + iHeaderRow, v: "CBM", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "M" + iHeaderRow, v: "Total Qty.", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "N" + iHeaderRow, v: "Qty/Ctn", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "O" + iHeaderRow, v: "Total N.W.(KG)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "P" + iHeaderRow, v: "Total G.W.(KG)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "Q" + iHeaderRow, v: "Unit Price(USD)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "R" + iHeaderRow, v: "Total Price(USD)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "S" + iHeaderRow, v: "Measurement", font: fontLabel, align: alignCenter });
                    mergeRanges.push("B" + iHeaderRow + ":C" + iHeaderRow);
                    mergeRanges.push("D" + iHeaderRow + ":E" + iHeaderRow);
                    break;
                case 3: // PL(通常)
                    cellData.push({ cell: "F" + iHeaderRow, v: "Description", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "H" + iHeaderRow, v: "HS CODE", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "J" + iHeaderRow, v: "PO NO.", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "L" + iHeaderRow, v: "PO Line", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "M" + iHeaderRow, v: "CTN NO", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "N" + iHeaderRow, v: "Total Qty.", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "O" + iHeaderRow, v: "Qty/Ctn", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "P" + iHeaderRow, v: "N.W.(KG/CTN)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "Q" + iHeaderRow, v: "G.W.(KG/CTN)", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "R" + iHeaderRow, v: "Measurement", font: fontLabel, align: alignCenter });
                    mergeRanges.push("B" + iHeaderRow + ":C" + iHeaderRow);
                    mergeRanges.push("D" + iHeaderRow + ":E" + iHeaderRow);
                    mergeRanges.push("F" + iHeaderRow + ":G" + iHeaderRow);
                    mergeRanges.push("H" + iHeaderRow + ":I" + iHeaderRow);
                    mergeRanges.push("J" + iHeaderRow + ":K" + iHeaderRow);
                    mergeRanges.push("R" + iHeaderRow + ":S" + iHeaderRow);
                    break;
                default:
                    break;
            }
        },

        _fillTableContent: function (iOutputOption, cellData, mergeRanges, oDataSource, worksheet) {
            var iBeginRow = 16,
                iRow = iBeginRow;
            var iTotalQuantity = 0,
                iTotalCTNQTY = 0,
                iTotalNetWeight = 0,
                iTotalGrossWeight = 0,
                iTotalPalletNetWeight = 0,
                iTotalPalletGrossWeight = 0,
                iItemPrice = 0,
                iTotalPrice = 0,
                iItemCBM = 0,
                iTotalCBM = 0;
            var aGroupedMap = new Map();
            var iTotalPackages = 0;
            oDataSource.to_ShippingInstructionDelivery.results.forEach((item, index) => {
                iRow += index;
                var oBoxItem = oDataSource.to_ShippingInstructionBox.results.find(p => p.BillingDocument === item.BillingDocument &&
                    p.BillingDocumentItem === item.BillingDocumentItem && p.SerialNumber === item.SerialNumber);
                var oPalletItem = oDataSource.to_ShippingInstructionPallet.results.find(p => p.BillingDocument === item.BillingDocument &&
                    p.BillingDocumentItem === item.BillingDocumentItem && p.SerialNumber === item.SerialNumber);

                // 单价
                iItemPrice = parseFloat(item.UnitPriceUSD) * parseFloat(item.ActualDeliveryQuantity);
                // 体积
                iItemCBM = this._calculateVolume(oBoxItem.BoxMeasureSize, oBoxItem.BoxQty);
                var sMeasure = (oBoxItem.BoxMeasureSize || "").trim(); // 尺寸字符串, 如 '505*505*510'
                var iCtnQty = parseInt(oBoxItem.BoxQty, 10) || 0;      // 箱数/件数
                if (sMeasure && iCtnQty > 0) {
                    // 累加总件数
                    iTotalPackages += iCtnQty;
                    // 如果已经存在该尺寸，则累加 Qty；不存在则初始化
                    if (aGroupedMap.has(sMeasure)) {
                        aGroupedMap.set(sMeasure, aGroupedMap.get(sMeasure) + iCtnQty);
                    } else {
                        aGroupedMap.set(sMeasure, iCtnQty);
                    }
                }

                iTotalQuantity += parseFloat(oBoxItem.ActualDeliveryQuantity);
                iTotalNetWeight += parseFloat(oBoxItem.HandlingUnitLoadWeight);
                iTotalGrossWeight += parseFloat(oBoxItem.HandlingUnitGrossWeight);
                iTotalPalletNetWeight += parseFloat(oPalletItem.PalletLoadWeight);
                iTotalPalletGrossWeight += parseFloat(oPalletItem.PalletGrossWeight);
                iTotalCTNQTY += parseFloat(oBoxItem.BoxQty);
                iTotalPrice += parseFloat(iItemPrice);
                iTotalCBM += parseFloat(iItemCBM);

                cellData.push({ cell: "A" + iRow, v: item.SerialNumber, font: fontValue, align: alignCenter });
                cellData.push({ cell: "B" + iRow, v: item.Product, font: fontValue, align: alignCenter });
                cellData.push({ cell: "D" + iRow, v: item.MaterialByCustomer, font: fontValue, align: alignCenter });
                switch (iOutputOption) {
                    case 0: // PL(FUJIFILM)
                        cellData.push({ cell: "F" + iRow, v: item.PurchaseOrderByCustomer, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "G" + iRow, v: item.CustomerPurchaseOrderItem, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "H" + iRow, v: oBoxItem.BoxNumberRange, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "I" + iRow, v: oBoxItem.ActualDeliveryQuantity, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "J" + iRow, v: oBoxItem.PerBoxTargetQty, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "K" + iRow, v: oBoxItem.HandlingUnitLoadWeight, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "L" + iRow, v: oBoxItem.HandlingUnitGrossWeight, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "M" + iRow, v: oBoxItem.BoxMeasureSize, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "O" + iRow, v: oPalletItem.PalletNumberRange, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "P" + iRow, v: oPalletItem.PalletLoadWeight, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "Q" + iRow, v: oPalletItem.PalletGrossWeight, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "R" + iRow, v: oBoxItem.BoxQty, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "S" + iRow, v: iItemCBM, font: fontValue, align: alignCenter });
                        mergeRanges.push("B" + iRow + ":C" + iRow);
                        mergeRanges.push("D" + iRow + ":E" + iRow);
                        mergeRanges.push("M" + iRow + ":N" + iRow);
                        break;
                    case 1: // PL(保税区)
                    case 2: // PL(福保)
                        cellData.push({ cell: "F" + iRow, v: oBoxItem.DeliveryDocumentItemText, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "G" + iRow, v: oBoxItem.CommodityCode, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "H" + iRow, v: item.PurchaseOrderByCustomer, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "I" + iRow, v: item.CustomerPurchaseOrderItem, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "J" + iRow, v: item.BoxNumberRange, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "K" + iRow, v: oBoxItem.BoxQty, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "L" + iRow, v: iItemCBM, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "M" + iRow, v: oBoxItem.ActualDeliveryQuantity, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "N" + iRow, v: oBoxItem.PerBoxTargetQty, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "O" + iRow, v: oPalletItem.PalletLoadWeight, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "P" + iRow, v: oPalletItem.PalletGrossWeight, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "Q" + iRow, v: item.UnitPriceUSD, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "R" + iRow, v: iItemPrice.toFixed(4), font: fontValue, align: alignCenter });
                        cellData.push({ cell: "S" + iRow, v: oBoxItem.BoxMeasureSize, font: fontValue, align: alignCenter });
                        mergeRanges.push("B" + iRow + ":C" + iRow);
                        mergeRanges.push("D" + iRow + ":E" + iRow);
                        break;
                    case 3: // PL(通常)
                        cellData.push({ cell: "F" + iRow, v: oBoxItem.DeliveryDocumentItemText, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "H" + iRow, v: oBoxItem.CommodityCode, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "J" + iRow, v: item.PurchaseOrderByCustomer, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "L" + iRow, v: item.CustomerPurchaseOrderItem, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "M" + iRow, v: oBoxItem.BoxNumberRange, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "N" + iRow, v: oBoxItem.ActualDeliveryQuantity, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "O" + iRow, v: oBoxItem.PerBoxTargetQty, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "P" + iRow, v: oPalletItem.PalletLoadWeight, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "Q" + iRow, v: oPalletItem.PalletGrossWeight, font: fontValue, align: alignCenter });
                        cellData.push({ cell: "R" + iRow, v: oBoxItem.BoxMeasureSize, font: fontValue, align: alignCenter });
                        mergeRanges.push("B" + iRow + ":C" + iRow);
                        mergeRanges.push("D" + iRow + ":E" + iRow);
                        mergeRanges.push("F" + iRow + ":G" + iRow);
                        mergeRanges.push("H" + iRow + ":I" + iRow);
                        mergeRanges.push("J" + iRow + ":K" + iRow);
                        mergeRanges.push("R" + iRow + ":S" + iRow);
                        break;
                    default:
                        break;
                }
            });
            // 为Table区域所有单元格加全外框线
            for (let r = 15; r <= 15 + oDataSource.to_ShippingInstructionDelivery.results.length; r++) {
                for (let c = 1; c <= 19; c++) {
                    const cell = worksheet.getCell(r, c);
                    cell.border = borderThin;
                }
            }
            // 合计行
            iRow += 1;
            iTotalNetWeight = iTotalNetWeight.toFixed(3);
            iTotalGrossWeight = iTotalGrossWeight.toFixed(3);
            iTotalPalletNetWeight = iTotalPalletNetWeight.toFixed(3);
            iTotalPalletGrossWeight = iTotalPalletGrossWeight.toFixed(3);
            iTotalPrice = iTotalPrice.toFixed(4);
            iTotalCBM = iTotalCBM.toFixed(3);
            switch (iOutputOption) {
                case 0: // PL(FUJIFILM)
                    cellData.push({ cell: "H" + iRow, v: "Total:", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "I" + iRow, v: iTotalQuantity, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "K" + iRow, v: iTotalNetWeight, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "L" + iRow, v: iTotalGrossWeight, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "P" + iRow, v: iTotalPalletNetWeight, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "Q" + iRow, v: iTotalPalletGrossWeight, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "R" + iRow, v: iTotalCTNQTY, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "S" + iRow, v: iTotalCBM, font: fontValue, align: alignCenter });
                    break;
                case 1: // PL(保税区)
                case 2: // PL(福保)
                    cellData.push({ cell: "J" + iRow, v: "Total:", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "K" + iRow, v: iTotalCTNQTY, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "L" + iRow, v: iTotalCBM, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "M" + iRow, v: iTotalQuantity, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "O" + iRow, v: iTotalPalletNetWeight, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "P" + iRow, v: iTotalPalletGrossWeight, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "R" + iRow, v: iTotalPrice, font: fontValue, align: alignCenter });
                    break;
                case 3: // PL(通常)
                    cellData.push({ cell: "M" + iRow, v: "Total:", font: fontLabel, align: alignCenter });
                    cellData.push({ cell: "N" + iRow, v: iTotalQuantity, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "P" + iRow, v: iTotalPalletNetWeight, font: fontValue, align: alignCenter });
                    cellData.push({ cell: "Q" + iRow, v: iTotalPalletGrossWeight, font: fontValue, align: alignCenter });
                    break;
                default:
                    break;
            }

            iRow += 1;
            cellData.push({ cell: "C" + iRow, v: "Package Size:", font: fontLabel, align: alignLeft });
            mergeRanges.push("C" + iRow + ":F" + iRow);
            aGroupedMap.forEach(function (iQty, sMeasure) {
                iRow += 1;
                // 格式化为：尺寸MM*数量
                cellData.push({ cell: "C" + iRow, v: sMeasure + "MM*" + iQty, font: fontLabel, align: alignLeft });
                mergeRanges.push("C" + iRow + ":F" + iRow);
            });
            iRow += 1;
            cellData.push({ cell: "B" + iRow, v: "TOTAL:", font: fontLabel, align: alignLeft });
            cellData.push({ cell: "C" + iRow, v: iTotalPackages + " Packages, W.G(Include Pallet):" + iTotalPalletGrossWeight + " KG", font: fontLabel, align: alignLeft });
            mergeRanges.push("C" + iRow + ":F" + iRow);
            iRow += 1;
            cellData.push({ cell: "B" + iRow, v: "Vehicle No.:", font: fontLabel, align: alignLeft });
            mergeRanges.push("C" + iRow + ":F" + iRow);
            iRow += 1;
            cellData.push({ cell: "B" + iRow, v: "Waybill No.:", font: fontLabel, align: alignLeft });
            cellData.push({ cell: "C" + iRow, v: oDataSource.WayBill, font: fontLabel, align: alignLeft });
            mergeRanges.push("C" + iRow + ":F" + iRow);
            iRow += 1;
            cellData.push({ cell: "O" + iRow, v: "For and on behalf of", font: fontLabel, align: alignCenter });
            mergeRanges.push("O" + iRow + ":Q" + iRow);
            iRow += 1;
            cellData.push({ cell: "O" + iRow, v: "UMC ELECTRONICS HONG KONG LTD.", font: fontLabel, align: alignCenter });
            mergeRanges.push("O" + iRow + ":Q" + iRow);
            iRow += 1;
            for (let c = 15; c <= 17; c++) {
                const cell = worksheet.getCell(iRow, c);
                cell.border = borderThinBottom;
            }
            iRow += 1;
            cellData.push({ cell: "O" + iRow, v: "Authorized Signature", font: fontLabel, align: alignCenter });
            mergeRanges.push("O" + iRow + ":Q" + iRow);
        }
    });
});