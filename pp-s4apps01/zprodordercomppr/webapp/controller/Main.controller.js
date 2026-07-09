sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet"
], function (Base, formatter, BusyDialog, MessageBox, MessageToast, Spreadsheet) {
    "use strict";

    return Base.extend("pp.zprodordercomppr.controller.Main", {
        formatter: formatter,
        
        onInit: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            this._BusyDialog = new BusyDialog();
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zprodordercomppr-View")) {
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
                        Create: aAllAccessBtns.some(btn => btn.AccessId === "zprodordercomppr-Create"),
                        Add: aAllAccessBtns.some(btn => btn.AccessId === "zprodordercomppr-Add"),
                        Delete: aAllAccessBtns.some(btn => btn.AccessId === "zprodordercomppr-Delete"),
                        // Export: aAllAccessBtns.some(btn => btn.AccessId === "zprodordercomppr-Export")
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

        onSearch: function () {
            // // Action后，清除前端缓存的数据
            //  var oBinding = this.byId("idTable").getBinding("rows");
            // if (oBinding) {
            //     oBinding.getContexts().forEach(function(oContext){
            //         oContext.getModel().setProperty(
            //             oContext.getPath()+"/Status",
            //             ""
            //         );
            //         oContext.getModel().setProperty(
            //             oContext.getPath()+"/Message",
            //             ""
            //         );
            //     });
            // }
        },

        onBeforeRebindTable: function (oEvent) {
            var oBinding = oEvent.getParameter("bindingParams");
            var aFilters = oBinding.filters;
            if (!aFilters) {
                aFilters = [];
            }

            var bSelected = this.byId("idCB1").getSelected();
            var oExcludeItemsWithPr = new sap.ui.model.Filter({
                path: "ExcludeItemsWithPr",
                operator: "EQ",
                value1: bSelected
            });
            aFilters.push(oExcludeItemsWithPr);

            oBinding.events = {
                dataReceived: this.onDataReceived.bind(this)
            };
        },

        onDataReceived: function (oEvent) {
            var oBinding = this.byId("idTable").getBinding("rows");
            var iDataLines = oBinding.getLength();
            this.getModel("local").setProperty("/dataLines", iDataLines);
        },

        onCreate: function () {
            this._callOData("Create");
        },

        onAdd: function () {
            this._callOData("Add");
        },

        onDelete: function () {
            this._callOData("Delete");
        },

        _callOData: function (sEvent) {
            var oTable = this.byId("idTable");
            var aSelectedIndices = oTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noSelectedRows"));
                return;
            }

            var aRequestData = [];
            aSelectedIndices.forEach(iSelectedIndices => {
                var oContext = this.byId("idTable").getContextByIndex(iSelectedIndices);
                aRequestData.push({
                    Status: '',
                    Message: '',
                    Plant: oContext.getObject().Plant,
                    ManufacturingOrder: oContext.getObject().ManufacturingOrder,
                    Assembly: oContext.getObject().Assembly,
                    Material: oContext.getObject().Material,
                    ProductDescription: oContext.getObject().ProductDescription,
                    GoodsMovementEntryQty: oContext.getObject().GoodsMovementEntryQty,
                    EntryUnit: oContext.getObject().EntryUnit,
                    PrNo: oContext.getObject().PrNo,
                    PrItem: oContext.getObject().PrItem,
                    PrPlant: oContext.getObject().PrPlant,
                    PrType: oContext.getObject().PrType,
                    PurchasingInfoRecord: oContext.getObject().PurchasingInfoRecord,
                    Supplier: oContext.getObject().Supplier,
                    CompanyCode: oContext.getObject().CompanyCode,
                    PurchaseOrg: oContext.getObject().PurchaseOrg,
                    PurchaseGrp: oContext.getObject().PurchaseGrp,
                    Currency: oContext.getObject().Currency,
                    Quantity: oContext.getObject().Quantity,
                    Unit: oContext.getObject().Unit,
                    Price: oContext.getObject().Price,
                    UnitPrice: oContext.getObject().UnitPrice,
                    DeliveryDate: oContext.getObject().DeliveryDate,
                    Location: oContext.getObject().Location, 
                    PrBy: oContext.getObject().PrBy,
                    ApproveStatus: oContext.getObject().ApproveStatus,
                    IsLinked: oContext.getObject().IsLinked,
                    IsApproved: oContext.getObject().IsApproved,
                    LocalCreatedBy: oContext.getObject().LocalCreatedBy,
                    LocalCreatedAt: oContext.getObject().LocalCreatedAt,
                    Reservation: oContext.getObject().Reservation,
                    ReservationItem: oContext.getObject().ReservationItem,
                    PurgDocOrderQuantityUnit: oContext.getObject().PurgDocOrderQuantityUnit
                });
            });

            var aPromise = [];
            aPromise.push(this._CallODataV2("ACTION", "/processLogic", [], {
                "Event": sEvent,
                "Zzkey": JSON.stringify(aRequestData),
                "RecordUUID": ""
            }, {}));
            try {
                this._BusyDialog.open();
                Promise.all(aPromise).then((aContext) => {
                    this._BusyDialog.close();
                    // for (const activeContext of aContext) {
                    //     var object = activeContext.processLogic;

                    //     aSelectedIndices.forEach(iIndices => {
                    //         var oContext = oTable.getContextByIndex(iIndices);
                    //         var oRowData = oContext.getObject();

                    //         var oResult = JSON.parse(object.Zzkey).find(function (item) {
                    //             return String(item.RESERVATION) === String(oRowData.Reservation) && String(item.RESERVATIONITEM) === String(oRowData.ReservationItem);
                    //         });

                    //         if (oResult) {
                    //             oContext.getModel().setProperty(
                    //                 oContext.getPath() + "/Status",
                    //                 oResult.STATUS
                    //             );

                    //             oContext.getModel().setProperty(
                    //                 oContext.getPath() + "/Message",
                    //                 oResult.MESSAGE
                    //             );
                    //         }
                    //     });
                    // }

                    MessageToast.show(this.getModel("i18n").getResourceBundle().getText("ProcessingCompleted"));
                    // this.byId("idSmartTable").rebindTable();
                    oTable.getBinding("rows").refresh();
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                    this._BusyDialog.close();
                });
            } catch (error) {
                MessageBox.error(error);
                this._BusyDialog.close();
            }
        },

        onExport: function () {
            var oTable = this.byId("idTable");
            var oBinding = oTable.getBinding("rows");
            var aExcelSet = oBinding.getContexts().map(function (oContext) {
                return oContext.getObject();
            });
            var aExcelCol = [];
            var aTableCol = oTable.getColumns();
            for (var i = 0; i < aTableCol.length; i++) {
                if (aTableCol[i].getVisible()) {
                    var sLabelText = aTableCol[i].getAggregation("label").getText();
                    var sType, sTextAlign, sUnitProperty, bDelimiter, iScale;
                    var sFieldName = aTableCol[i].getAggregation("template").getBindingPath("text");
                    if (!sFieldName) {
                        sFieldName = aTableCol[i].getAggregation("template").mBindingInfos.state.parts[0].path;
                    }

                    switch (sFieldName) {
                        //  Number 
                        case "GoodsMovementEntryQty": 
                        case "Quantity": 
                        case "Price": 
                        case "UnitPrice": 
                        case "PurgDocOrderQuantityUnit": 
                            sType = sap.ui.export.EdmType.Number;
                            bDelimiter = true;
                            sTextAlign = "End";
                            // iScale = 3;
                            // sUnitProperty = "";
                            break;
                        // Date
                        case "DeliveryDate":
                            sType = sap.ui.export.EdmType.Date;
                            sTextAlign = "Begin";
                            break;
                        default:
                            sType = sap.ui.export.EdmType.String;
                            sTextAlign = "Begin";
                            break;
                    }
                    var oExcelCol = {
                        label: sLabelText,
                        type: sType,
                        property: sFieldName,
                        width: parseFloat(aTableCol[i].getWidth()),
                        textAlign: sTextAlign,
                        unitProperty: sUnitProperty,
                        delimiter: bDelimiter,
                        scale: iScale
                    };
                    aExcelCol.push(oExcelCol);
                }
            }
            var oSettings = {
                workbook: {
                    columns: aExcelCol,
                    context: {
                        version: "1.54",
                        hierarchyLevel: "level"
                    }
                },
                dataSource: aExcelSet,
                fileName: this.getModel("i18n").getResourceBundle().getText("appTitle") + "_" + this.getCurrentDateTime() + ".xlsx"
            };
            // Export excel file
            new Spreadsheet(oSettings).build();
        },

        onBeforeExport: function (oEvent) {
            var oExcelSettings = oEvent.getParameter("exportSettings");
            var columns = oExcelSettings.workbook.columns;
            columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "GoodsMovementEntryQty": 
                    case "Quantity": 
                    case "Price": 
                    case "UnitPrice": 
                    case "PurgDocOrderQuantityUnit": 
                        oColumn.type = sap.ui.export.EdmType.Number;
                        oColumn.textAlign = "End";
                        break;
                    case "DeliveryDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                    default:
                        break;
                }
            });

            var sFileName = this.getModel("i18n").getResourceBundle().getText("appTitle");
            this.exportExcel(oExcelSettings, sFileName);
        },

        exportExcel: function (mExcelSettings, sFileName) {
            mExcelSettings.fileName = sFileName + "_" + this.getCurrentDateTime();
        }
    });
});
