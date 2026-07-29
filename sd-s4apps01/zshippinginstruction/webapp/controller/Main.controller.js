/* global XLSX:true */
sap.ui.define([
    "./Base",
    "../lib/xlsx.bundle",
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

    return Base.extend("sd.zshippinginstruction.controller.Main", {

        onInit() {
            this._myBusyDialog = new BusyDialog();
            // this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            // var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            // var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            // var oContextBinding = this.getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
            //     "$expand": "_AssignPlant,_AssignCompany,_AssignSalesOrg,_AssignPurchOrg,_AssignRole($expand=_UserRoleAccessBtn)"
            // });
            // oContextBinding.requestObject().then(function (context) {
            //     var aAccessBtns = [],
            //         aAllAccessBtns = [];
            //     if (context._AssignRole && context._AssignRole.length > 0) {
            //         context._AssignRole.forEach(role => {
            //             aAccessBtns.push(role._UserRoleAccessBtn);
            //         });
            //         aAllAccessBtns = aAccessBtns.flat();
            //     }
            //     if (!aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-View")) {
            //         if (!this.oErrorMessageDialog) {
            //             this.oErrorMessageDialog = new sap.m.Dialog({
            //                 type: sap.m.DialogType.Message,
            //                 state: "Error",
            //                 content: new sap.m.Text({
            //                     text: this.getModel("i18n").getResourceBundle().getText("noAuthorityView", [sUser])
            //                 })
            //             });
            //         }
            //         this.getView().destroy();
            //         this.oErrorMessageDialog.open();
            //     }
            this.getModel("local").setProperty("/authorityCheck", {
                button: {
                    View: true, // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-View"),
                    Maintain: true, // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Maintain"),
                    Delete: true, // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Delete"),
                    Print: true, // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Print"),
                    Export: true, // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Export"),
                    LoadDelivery: true, // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-LoadDelivery"),
                    WritePackageStructure: true, // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-WritePackageStructure"),
                    Recalculate: true, // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Recalculate"),
                    Approve: true, // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-Approve"),
                    CancelApproval: true, // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-CancelApproval"),
                    SplitLine: true, // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-SplitLine"),
                    ResetLine: true // aAllAccessBtns.some(btn => btn.AccessId === "zshippinginstruction-ResetLine")
                },
                data: {
                    // PlantSet: context._AssignPlant,
                    // CompanySet: context._AssignCompany,
                    // SalesOrgSet: context._AssignSalesOrg,
                    // PurchOrgSet: context._AssignPurchOrg,
                    // RoleSet: context._AssignRole
                }
            });
            // }.bind(this), function (oError) {
            //     if (!this.oErrorMessageDialog) {
            //         this.oErrorMessageDialog = new sap.m.Dialog({
            //             type: sap.m.DialogType.Message,
            //             state: "Error",
            //             content: new sap.m.Text({
            //                 text: this.getModel("i18n").getResourceBundle().getText("getAuthorityFailed")
            //             })
            //         });
            //     }
            //     this.getView().destroy();
            //     this.oErrorMessageDialog.open();
            // }.bind(this));
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
            switch (sAction) {
                case "Maintain":
                    this._maintain();
                    break;
                case "Delete":
                    this._delete();
                    break;
                case "Print":
                    this._print();
                    break;
                case "Export":
                    this._export();
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

        _print: function () {
            var oReportTable = this.byId("idStandardListTable");
            var aSelectedIndices = oReportTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                MessageBox.error(this.getResourceBundle().getText("NoneSelected"));
                return;
            }
            var aRadioButton = [
                new RadioButton({ text: "{i18n>Option1}" }),
                new RadioButton({ text: "{i18n>Option2}" }),
                new RadioButton({ text: "{i18n>Option3}" }),
                new RadioButton({ text: "{i18n>Option4}" })
            ];
            this._openOutputDialog("Print", "PDF", aRadioButton);
        },

        _export: function () {
            var oReportTable = this.byId("idStandardListTable");
            var aSelectedIndices = oReportTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                MessageBox.error(this.getResourceBundle().getText("NoneSelected"));
                return;
            }
            var aRadioButton = [
                new RadioButton({ text: "{i18n>Option1}" }),
                new RadioButton({ text: "{i18n>Option2}" }),
                new RadioButton({ text: "{i18n>Option3}" }),
                new RadioButton({ text: "{i18n>Option4}" })
            ];
            this._openOutputDialog("Export", "Excel", aRadioButton);
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
                var oParsedZzkey = this.convJsonKeys2Metadata(res.processLogic.Zzkey);
                if (oParsedZzkey.haserror) {
                    MessageToast.show(this.getResourceBundle().getText("ProcessError"));
                } else {
                    MessageToast.show(this.getResourceBundle().getText("ProcessSuccess"));
                    this.getModel("local").setProperty("/Header/IsExists", true);
                    this.getModel().refresh();
                }
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
                            this._loadLatestPackingData(oParsedZzkey.Header, function () {
                                if (oParsedZzkey.haserror) {
                                    MessageToast.show(this.getResourceBundle().getText("ProcessError"));
                                } else {
                                    MessageToast.show(this.getResourceBundle().getText("ProcessSuccess"));
                                }
                                oApproverInput.setValue("");
                                this._oApproveDialog.destroy();
                            }.bind(this));
                        }.bind(this));
                    }.bind(this)
                }),
                endButton: new Button({
                    text: "{i18n>Cancel}",
                    press: function () {
                        oApproverInput.setValue("");
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

        _openOutputDialog: function (sAction, sFormat, aRadioButton) {
            this._myBusyDialog.open();
            var oRadioButtonGroup = new RadioButtonGroup({
                columns: 1,
                buttons: aRadioButton
            });
            oRadioButtonGroup.addStyleClass("sapUiSmallMargin");
            this._oOutputDialog = new Dialog({
                title: this.getResourceBundle().getText("OutputOptions", [this.getResourceBundle().getText(sAction), this.getResourceBundle().getText(sFormat)]),
                content: [oRadioButtonGroup],
                beginButton: new Button({
                    text: "{i18n>Confirm}",
                    type: ButtonType.Emphasized,
                    press: function () {
                        this._OutputFile(sAction, oRadioButtonGroup.getSelectedIndex());
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

        _OutputFile: function (sAction, iSelectedIndex) {
            var sOutputOption = "";
            switch (iSelectedIndex) {
                case 0:
                    sOutputOption = "PL(FUJIFILM)";
                    break;
                case 1:
                    sOutputOption = "PL(保税区)";
                    break;
                case 2:
                    sOutputOption = "PL(福保)";
                    break;
                case 3:
                    sOutputOption = "PL(通常)";
                    break;
                default:
                    break;
            }
            this.onExportExcel();
            MessageBox.information("OutputFile" + "_" + sAction + "_" + sOutputOption);
        },

        onExportExcel: function () {
            // 假设这是从后台/模型中获取的真实业务数据
            var oData = {
                toNo: "7100103303",
                declareDate: "2025/12/26",
                consignee: "NICHICON CORPORATION",
                deliveryPlace: "FUJIFILM 大和D栋(物流园)",
                items: [
                    { line: 1, modelNo: "ZSFLF17IC", custModelNo: "105E 21602", poNo: "2512371164", poLine: "15", ctnNo: "1-10", totalQty: 50, qtyCtn: 5, netWeight: 4.0475, grossWeight: 7.550, measurement: "405*290*150", netWeightTotal: 40.4750, grossWeightTotal: 121.900, ctnQty: 10, cbm: 0.177 },
                    { line: 2, modelNo: "ZSFLD27XE", custModelNo: "105E 20995", poNo: "2512371159", poLine: "3", ctnNo: "11-11", totalQty: 5, qtyCtn: 5, netWeight: 9.9365, grossWeight: 12.390, measurement: "440*430*210", netWeightTotal: 9.9365, grossWeightTotal: 12.390, ctnQty: 1, cbm: 0.040 }
                ]
            };

            // 1. 构建 Excel 二维数组数据结构 (与图片逐行对应)
            var aoaData = [
                ["", "", "", "", "", "UMC Electronics Hong Kong Limited", "", "", "", "", "", "", "", "", "", "", ""], // Row 0
                ["", "", "", "", "", "Unit B, 20/F., Reason Group Tower", "", "", "", "", "", "", "", "", "", "", ""],
                ["", "", "", "", "", "403-413 Castle Peak Road, Kwai Chung N.T., Hong Kong", "", "", "", "", "", "", "", "", "", "", ""],
                ["", "", "", "", "", "Tel: 852-26205797 , Fax: 852-26206037", "", "", "", "", "", "", "", "", "", "", ""],
                ["Consignee:", oData.consignee, "", "Delivery Place:", oData.deliveryPlace, "", "", "", "", "", "", "TO No.:", oData.toNo, "", "Transportation:", "TRUCK"],
                ["ADD:", "Tokyo Development...", "", "ADD:", "深圳市龙华区观湖街道...", "", "", "", "", "", "", "Declare Date:", oData.declareDate, "", "Delivery Term:", "DDUCN"],
                ["ATTN:", "Yasushi Suzuki", "", "ATTN:", "涂为群", "", "", "", "", "", "", "Prepared Date:", "2025/12/24", "", "", ""],
                ["TEL:", "81-3-3666-7925", "", "TEL:", "(0755)2798-1111", "", "", "", "", "", "", "", "", "", "", ""],
                // Row 8: 明细表头
                ["TO line", "MODEL NO.", "Customer Model No.", "PO NO", "PO Line", "CTN NO.", "TOTAL (pcs)", "QTY/Ctn(pcs)", "Net Weight(kg)", "Gross Weight/ctn", "Measurement", "PALLET NO.", "总净重 (kg)", "总毛重 (kg)", "箱数 CTN QTY", "体积 CBM(Total CTNS)"]
            ];

            // 2. 动态填充明细行数据
            oData.items.forEach(function (item) {
                aoaData.push([
                    item.line, item.modelNo, item.custModelNo, item.poNo, item.poLine, item.ctnNo,
                    item.totalQty, item.qtyCtn, item.netWeight, item.grossWeight, item.measurement,
                    "1-4", item.netWeightTotal, item.grossWeightTotal, item.ctnQty, item.cbm
                ]);
            });

            // 3. 追加底部 Total 及 签名栏数据
            aoaData.push(["", "", "", "", "", "TOTAL :", 55, "", "", "", "", "TOTAL", 50.4115, 134.290, 11, 0.217]);
            aoaData.push([]);
            aoaData.push(["Package Size:", "1100*1100*1400MM*4", "", "", "", "", "", "", "", "", "", "", "", "For and on behalf of"]);
            aoaData.push(["TOTAL:", "2 Packages, W.G: 134.29 KG", "", "", "", "", "", "", "", "", "", "", "", "UMC ELECTRONICS HONG KONG LTD."]);
            aoaData.push([]);
            aoaData.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "____________________"]);
            aoaData.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "Authorized Signature"]);

            // 4. 将 AOA 转为 Worksheet
            var worksheet = XLSX.utils.aoa_to_sheet(aoaData);

            // 5. 设置单元格合并 (Merge)
            worksheet['!merges'] = [
                // 顶部公司名称合并
                { s: { r: 0, c: 5 }, e: { r: 0, c: 10 } },
                { s: { r: 1, c: 5 }, e: { r: 1, c: 10 } },
                { s: { r: 2, c: 5 }, e: { r: 2, c: 10 } },
                { s: { r: 3, c: 5 }, e: { r: 3, c: 10 } },
                // 右侧黄框明细表头合并 ("卡板编号" 合并多行)
                { s: { r: 9, c: 11 }, e: { r: 9 + oData.items.length - 1, c: 11 } },
                // 底部签名栏合并
                { s: { r: aoaData.length - 4, c: 13 }, e: { r: aoaData.length - 4, c: 16 } },
                { s: { r: aoaData.length - 3, c: 13 }, e: { r: aoaData.length - 3, c: 16 } }
            ];

            // 6. 设置黄色表头样式 (针对 PALLET NO. 至 CBM 区域)
            var yellowHeaderStyle = {
                fill: { fgColor: { rgb: "FFFF00" } }, // 黄色背景
                font: { bold: true, sz: 10 },
                alignment: { horizontal: "center", vertical: "center", wrapText: true },
                border: {
                    top: { style: "thin" }, bottom: { style: "thin" },
                    left: { style: "thin" }, right: { style: "thin" }
                }
            };

            // 为第 8 行 (表头) 的右侧黄色区域添加样式 (Col 11 到 15)
            for (var c = 11; c <= 15; c++) {
                var cellAddress = XLSX.utils.encode_cell({ r: 8, c: c });
                if (worksheet[cellAddress]) {
                    worksheet[cellAddress].s = yellowHeaderStyle;
                }
            }

            // 7. 设置列宽 (Column Widths)
            worksheet['!cols'] = [
                { wch: 8 },  // TO line
                { wch: 15 }, // MODEL NO.
                { wch: 18 }, // Customer Model No.
                { wch: 25 }, // PO NO
                { wch: 10 }, // PO Line
                { wch: 12 }, // CTN NO.
                { wch: 12 }, // TOTAL (pcs)
                { wch: 12 }, // QTY/Ctn
                { wch: 15 }, // Net Weight
                { wch: 15 }, // Gross Weight
                { wch: 18 }, // Measurement
                { wch: 12 }, // PALLET NO.
                { wch: 15 }, // 总净重
                { wch: 15 }, // 总毛重
                { wch: 12 }, // 箱数
                { wch: 18 }  // 体积 CBM
            ];

            // 8. 创建 Workbook 并导出文件
            var workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Packing List");

            // 下载文件
            XLSX.writeFile(workbook, "Packing_List_" + oData.toNo + ".xlsx");
        }
    });
});