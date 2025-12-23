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
    "sap/ui/core/Fragment"
], function (Base, ValueHelpDialog, formatter, BusyDialog, MessageBox, MessageToast, Messaging, Message, MessageType, Fragment) {
    "use strict";

    return Base.extend("pp.zngmanangement.controller.Detail", {

        ValueHelpDialog: ValueHelpDialog,
        formatter: formatter,

        onInit: function () {
            this.getRouter().getRoute("Detail").attachMatched(this._initialize, this);
        },

        onBeforeRendering: function () {
            this._BusyDialog = this.getModel("local").getProperty("/BusyDialog");
            // set message model
            Messaging.removeAllMessages();

            this.getView().setModel(Messaging.getMessageModel(), "message");

            //activate automatic message generation for complete view
            Messaging.registerObject(this.getView(), true);
        },

        _initialize: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            var sNG_No = oArgs.NG_No;
            if (sNG_No === "INITIAL") {
                // Create
                this._Operation = "Create";
                var oCreateContext = this.getModel().createEntry("/NG_Header", { NG_No: sNG_No });
                this.sCreatePath = oCreateContext.getPath();
                this.getView().setBindingContext(oCreateContext);
                this.getModel("local").setProperty("/NG_No", sNG_No);

                // Create Control
                this.byId("idButtonEdit").setVisible(false);
                this.byId("idButtonDelete").setVisible(false);
                this.byId("idPlant").setEditable(true);
                this.getModel("local").setProperty("/Control/editable", false);
                this.getModel("local").setProperty("/Control/showFooter", true);
            } else {
                // Display
                this._Operation = "Display";
                this.byId("idButtonEdit").setVisible(true);

            }
            this.getModel("local").setProperty("/Operation", this._Operation);
            this._BusyDialog.close();
        },

        onEdit: function () {
            if (this._Operation === "Create") {
                this.byId("idPlant").setEditable(true);
                this.getModel("local").setProperty("/Control/editable", false);
            } else {
                this.byId("idPlant").setEditable(false);
            }
            this.byId("idButtonEdit").setVisible(false);
            this.getModel("local").setProperty("/Control/showFooter", true);
        },

        onCancel: function () {
            // Clear Value
            this.getModel().resetChanges();
            this.getModel("local").setProperty("/NG_Item", []);
            // View Control
            this.byId("idPlant").setEditable(false);
            this.byId("idButtonEdit").setVisible(true);
            this.getModel("local").setProperty("/Control/editable", false);
            this.getModel("local").setProperty("/Control/showFooter", false);
        },

        onSmartFieldInputChange: function (oEvent) {
            var sPath = oEvent.getSource().getBindingContext().getPath();
            var sProperty = oEvent.getSource().getBindingPath("value");
            var sValue = oEvent.getParameter('value');
            switch (oEvent.getSource().getDataType()) {
                case 'Edm.DateTime':
                case 'Edm.Date':
                    break;
                default:
                    this.getModel().setProperty(sPath + "/" + sProperty, sValue);
                    break;
            }
            if (!sValue) {
                this.getModel().setProperty(sPath + "/" + sProperty + "Name", "");
            }
            if (sProperty === "Plant" && sValue) {
                this.byId("idPlant").setEditable(false);
                this.getModel("local").setProperty("/NG_Header/Plant", sValue);
                this.getModel("local").setProperty("/Control/editable", true);
            }
            this.resetSmartControlState();
        },

        onPressFunction: function (sEvent) {
            var oNG_HeaderD = this.getModel().getObject(this.sCreatePath);
            if (sEvent === "SAVE") {
                Messaging.removeAllMessages();

                // Call the check method
                var checkPromise = this.byId("idNG_Header_SF").check();

                // Handle the Promise returned by check() in Async mode
                checkPromise.then(function (bValid) {
                    if (bValid) {
                        // Form is valid, proceed to save (e.g., oModel.submitChanges())
                        console.log("Form is valid, saving data...");
                    } else {
                        // Form has errors, messages will appear in the UI
                        console.log("Form has validation errors.");
                    }
                }).catch(function (oError) {
                    // Handle unexpected errors during validation
                    console.error("Error during form check:", oError);
                });

            } else if (sEvent === "DELETE") {

            }
        },


        onNG_Item: function (oEvent, sEvent) {
            var aNG_Item = this.getModel("local").getProperty("/NG_Item");
            if (sEvent === "ADD") {
                var item = {
                    NG_ItemNo: "",
                    Material: "",
                    MaterialName: "",
                    Quantity: "",
                    BaseUnit: "",
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
                    IQC_NG_Quantity: "",
                    IQC_OK_Quantity: "",
                    IQC_ApprovedBy: "",
                    IQC_Remark: ""
                };
                aNG_Item.push(item);
                aNG_Item.forEach((line, index) => {
                    line.NG_ItemNo = index + 1;
                });
                this.getModel("local").setProperty("/NG_Item", aNG_Item);
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
                            if (!key.includes("NG_ItemNo")) {
                                newItem[key] = copyItem[key];
                            }
                        }
                        aNG_Item.push(newItem);
                        aNG_Item.forEach((line, index) => {
                            line.NG_ItemNo = index + 1;
                        });
                        this.getModel("local").setProperty("/NG_Item", aNG_Item);
                        this.getModel("local").setProperty("/ItemEdit", aNG_Item[aNG_Item.length - 1]);
                        this.showEditItemDialog();
                        break;

                    case "EDIT":
                        var editItem = JSON.parse(JSON.stringify(aNG_Item[aSelectedIndices[0]]));
                        this.getModel("local").setProperty("/ItemEdit", editItem);
                        this.showEditItemDialog();
                        break;

                    case "DELETE":
                        var iLen = aSelectedIndices.length - 1;
                        do {
                            aNG_Item.splice(aSelectedIndices[iLen], 1);
                            // begin: clear value state
                            var oCells = oTable.getRows()[aSelectedIndices[0]].getCells();
                            oCells.forEach(cell => {
                                if (cell.sId.includes("input")) {
                                    cell.setValueState("None");
                                }
                            });
                            // end: clear value state
                            iLen--;
                        } while (iLen >= 0);
                        aNG_Item.forEach((line, index) => {
                            line.NG_ItemNo = index + 1;
                        });
                        this.getModel("local").setProperty("/NG_Item", aNG_Item);
                    default:
                        break;
                }
            }
        },

        onNG_ItemIQC: function (oEvent, sEvent) {
            var oTable = this.byId("idNG_Item_IQCTable");
            var aSelectedIndices = oTable.getSelectedIndices();
            var aNG_Item = this.getModel("local").getProperty("/NG_Item");
            switch (sEvent) {
                case "CLEAR":
                    if (aSelectedIndices.length === 0) {
                        return;
                    }
                    for (var i = 0; i < aSelectedIndices.length; i++) {
                        aNG_Item.forEach((line, index) => {
                            if (index === aSelectedIndices[i]) {
                                line.IQC_NG_Quantity = "";
                                line.IQC_OK_Quantity = "";
                                line.IQC_ApprovedBy = "";
                                line.IQC_Remark = "";
                            }
                        });
                    }
                    this.getModel("local").setProperty("/NG_Item", aNG_Item);
                    oTable.clearSelection();
                    break;
                default:
                    break;
            }
        },

        showEditItemDialog: function () {
            var that = this;
            this._BusyDialog = new BusyDialog();
            this._BusyDialog.open();
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
                        var aNG_Item = this.getModel("local").getProperty("/NG_Item");
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
                        this.getModel("local").setProperty("/NG_Item", aNG_Item);
                        this.getParent().destroy();
                    }
                }));
                this._oEditItemDialog.addButton(new sap.m.Button({
                    text: "{i18n>Cancel}",
                    press: function () {
                        that._oEditItemDialog.destroy();
                    }
                }));
                this._BusyDialog.close();
                this._oEditItemDialog.open();
            }.bind(this));
        },

        resetSmartControlState: function () {
            let oControl = this.byId("idNG_Header_SF");
            oControl.getSmartFields().forEach(function (oSmartField) {
                let aInnerControls = oSmartField.getInnerControls();
                aInnerControls.forEach(function (oInnerControl) {
                    if (oInnerControl.setValueState && oInnerControl.setValueStateText) {
                        oInnerControl.setValueState(sap.ui.core.ValueState.None);
                        oInnerControl.setValueStateText("");
                    }
                });
            });
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
        }
    });
});
