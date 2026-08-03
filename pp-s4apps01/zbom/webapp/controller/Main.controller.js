sap.ui.define([
    "./Base",
    "sap/ui/core/UIComponent",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    ".././lib/xml-js",
    "sap/m/plugins/CellSelector",
    "sap/m/plugins/CopyProvider",
    "sap/m/DynamicDateUtil",
    "sap/ui/model/Filter",
    "sap/ui/export/Spreadsheet"
], function (Base, UIComponent, BusyDialog, MessageBox, xml, CellSelector, CopyProvider, DynamicDateUtil, Filter, Spreadsheet) {
    "use strict";

    let oCellSelector;
    let oCopyProvider;
    return Base.extend("pp.zbom.controller.Main", {
        onInit: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);

            // Cell Copy
            if (window.isSecureContext) {
                const oTable = this.byId("idTable");
                oCellSelector = new CellSelector();
                oTable.addDependent(oCellSelector);

                oCopyProvider = new CopyProvider({ extractData: this.extractData, copy: this.onCopy });
                oTable.addDependent(oCopyProvider);

                const oToolbar = this.byId("idToolBar");
                oToolbar.addContent(oCopyProvider.getCopyButton());
            }
        },

        extractData: function (oRowContext, oColumn) {
            const oValue = oRowContext.getProperty(oColumn.getSortProperty());
            return oColumn.__type ? oColumn.__type.formatValue(oValue, "string") : oValue;
        },

        onCopy: function (oEvent) { },
        
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zbom-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zbom-View"),
                        Print: aAllAccessBtns.some(btn => btn.AccessId === "zbom-Print"),
                        PrintVN: aAllAccessBtns.some(btn => btn.AccessId === "zbom-PrintVN")
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

        onPrint: function (sEvent) {
            var that = this;
            var aSelectedIndices = this.byId("idTable").getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                return;
            } else if (aSelectedIndices.length > 1) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("onlyCanSelectOne"));
                return;
            } 

            var oTable = this.byId("idTable");
            var oBinding = oTable.getBinding();
            var aAllContexts = oBinding.getContexts();
            var aAllData = aAllContexts.map(ctx => ctx.getObject());
            var oSelected = oTable.getContextByIndex(aSelectedIndices[0]).getObject();
            var HeaderValidityStartDate = oSelected.HeaderValidityStartDate;
            var aItems = that.getItems(oSelected, aAllData);

            var aPromise = that._callOData(sEvent, aItems);
            try {
                Promise.all(aPromise).then((aContext) => {
                    if (aContext.length > 0) {
                        var pdfContent = that.processPrintContent(oSelected, aContext[0].results, HeaderValidityStartDate);
                        that.getPDF(pdfContent, "YY1_BOMPRINT");
                    } 
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                });
            } catch (error) {
                MessageBox.error(error);
            }
        },

        _callOData: function (sEvent, aItems,) {
            var aPromise = [];
            aPromise.push(this._CallODataV2("ACTION", "/PrintBom", [], {
                "Event": sEvent,
                "Zzkey": JSON.stringify(aItems),
                "RecordUUID": ""
            }, {}));

            return aPromise;
        },

        getItems: function (oSelected, aAllData) {
            var aItems = [];
            if (oSelected) {
                aItems.push({
                    Material: oSelected.Material,
                    BillOfMaterialComponent: oSelected.BillOfMaterialComponent
                });
            }
            return aItems;
        },

        getItems2: function (aFilters) {
            var aItems = [];

            aItems = aFilters.map(item => ({
                path: item.sPath,
                operator: item.sOperator,
                value1: item.oValue1,
                value2: item.oValue2
            }));
            return aItems;
        },

        processPrintContent: function (oSelected, aAllData, HeaderValidityStartDate) {
            var pdfContent = {
                PrintData: {
                    results: []
                }
            };

            var BomPrint = {
                //Head
                Document: aAllData[0].Document,
                ValidfromDate: aAllData[0].ValidfromDate,
                History: aAllData[0].History,
                Revision: aAllData[0].Revision,
                Model: aAllData[0].Model,
                Formula: aAllData[0].Formula,
                Description: aAllData[0].Description,
                Customer: aAllData[0].Customer,
                //Date: 
                to_Item: {
                    results: []
                }
            };

            BomPrint.to_Item.results = aAllData.map(item => ({
                Material: item.Material,
                BOMlevel: item.BOMlevel,
                AltGrp: item.AltGrp,
                FolGrp: item.FolGrp,
                PartNo: item.PartNo,
                PartName: item.PartName,
                Specification: item.Specification,
                MakerPartNo: item.MakerPartNo,
                Boi: item.Boi,
                RefNo: item.RefNo,
                Qty: item.Qty,
                Unit: item.Unit,
                Loc: item.Loc,
                SaftyCERT: item.SaftyCERT,
                ValidPeriod: item.ValidPeriod,
                Sup: item.Sup,
                Remark: item.Remark,
                CustomerPartNo: item.CustomerPartNo,
                RoHS: item.RoHS
            }));

            pdfContent = {
                PrintData: BomPrint
            };

            return pdfContent;
        },

        onPrintVN: function (sEvent) {
            var that = this;
            var aSelectedIndices = this.byId("idTable").getSelectedIndices();
            if (aSelectedIndices.length === 0) {
                return;
            } else if (aSelectedIndices.length > 1) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("onlyCanSelectOne"));
                return;
            }

            var oTable = this.byId("idTable");
            var oBinding = oTable.getBinding();
            var aAllContexts = oBinding.getContexts();
            var aAllData = aAllContexts.map(ctx => ctx.getObject());
            var oSelected = oTable.getContextByIndex(aSelectedIndices[0]).getObject();
            var HeaderValidityStartDate = oSelected.HeaderValidityStartDate;
            var aItems = that.getItems(oSelected, aAllData);

            var aPromise = that._callOData(sEvent, aItems);
            try {
                Promise.all(aPromise).then((aContext) => {
                    if (aContext.length > 0) {
                        var pdfContent = that.processPrintContent(oSelected, aContext[0].results, HeaderValidityStartDate);
                        that.getPDF(pdfContent, "YY1_BOMPRINT_VN");
                    }
                }).catch((error) => {
                    MessageBox.error(error);
                }).finally(() => {
                });
            } catch (error) {
                MessageBox.error(error);
            }
        },

        getPDF: function (pdfContent, sTemplateID) {
            var that = this;
            var oBusyDialog = new BusyDialog();
            var aRecordCreated = [];
            var sFileName = this.getView().getModel("i18n").getResourceBundle().getText("appTitle") + new Date().getTime();
            var promise = new Promise((resolve, reject) => {
                var createPrintRecord = this.getModel("Print").bindContext("/PrintRecord/com.sap.gateway.srvd.zui_prt_record_o4.v0001.createPrintRecord(...)");
                createPrintRecord.setParameter("TemplateID", sTemplateID || "YY1_BOMPRINT");
                createPrintRecord.setParameter("IsExternalProvidedData", true);
                var oXMLData = json2xml(pdfContent, {
                    compact: true,
                    ignoreComment: true,
                    spaces: 4
                });
                // var pdfData =  btoa(unescape(encodeURIComponent(oXMLData)));
                var pdfData = btoa(unescape(encodeURIComponent("<?xml version=\"1.0\" encoding=\"UTF-8\"?><form>" + oXMLData + "</form>")));
                createPrintRecord.setParameter("ExternalProvidedData", pdfData);
                // var uuidx16 = context.getObject().Uuid.replace(/-/g, '');
                createPrintRecord.setParameter("ProvidedKeys", "");
                createPrintRecord.setParameter("ResultIsActiveEntity", true);
                createPrintRecord.setParameter("FileName", sFileName);
                createPrintRecord.execute("$auto", false, null, /*bReplaceWithRVC*/false).then(() => {
                    resolve(createPrintRecord);
                }).catch((oError) => {
                    reject(oError);
                });
            });
            aRecordCreated.push(promise);

            oBusyDialog.open();
            try {
                Promise.all(aRecordCreated).then((aContext) => {
                    oBusyDialog.close();
                    var sURL;
                    for (const activeContext of aContext) {
                        var boundContext = activeContext.getBoundContext();
                        var object = boundContext.getObject();
                        var sPath = this.getModel("Print").getKeyPredicate("/PrintRecord", object);
                        sURL = activeContext.getModel("Print").getServiceUrl() + "PrintRecord" + sPath + '/PDFContent';
                        sap.m.URLHelper.redirect(sURL, true);
                    }
                    MessageToast.show("Print Success");
                }).finally(() => {
                    oBusyDialog.close();
                });
            } catch (error) {
                MessageToast.show(error);
                oBusyDialog.close();
            };
        },

        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        onBeforeRebindTable: function (oEvent) {
            let aFilters = oEvent.getParameters().bindingParams.filters;
            var oValDate = this.getOwnerComponent().getModel("local").getProperty("/ValDate");
            if (oValDate) {
                var aDates = DynamicDateUtil.toDates(oValDate);
                var oFmt = sap.ui.core.format.DateFormat.getDateInstance({
                    pattern: "yyyyMMdd",
                });
                var sDates = oFmt.format(aDates[0]);
                var oHeaderValidityStartDate = new sap.ui.model.Filter({
                    path: "HeaderValidityStartDate",
                    operator: "EQ",
                    value1: aDates[1] //sDates
                });

               aFilters.push(oHeaderValidityStartDate);
            };
        },

        onSearch: function (oEvent) {
            var aFilters, sPath;
                sPath = "/BOM";
                aFilters = this.byId("idSmartFilterBar").getFilters()[0].aFilters;
                var oValDate = this.getOwnerComponent().getModel("local").getProperty("/ValDate");
                if (oValDate) {
                    var aDates = DynamicDateUtil.toDates(oValDate);
                    var oHeaderValidityStartDate = new sap.ui.model.Filter({
                        path: "HeaderValidityStartDate",
                        operator: "EQ",
                        value1: aDates[1]
                    });

                aFilters.push(oHeaderValidityStartDate);
                };
            // }
            // 并行处理 优化速度
            this.getModel().setUseBatch(false);
            // this._CallODataV2("READ", sPath, aFilters, { "$top": 999999999 }, {}).then(function (oResponse) {
            //     if (oResponse) {
            //         this.getModel("local").setProperty("/Bom", oResponse.results);
            //     }
            this._loadAllData(sPath, aFilters).then(function (aAllData) {
                if (aAllData.length > 0) {
                    this.getModel("local").setProperty("/Bom", aAllData);
                }
                this.getModel().setUseBatch(true);
            }.bind(this)), function (oError) {
                this.getModel().setUseBatch(true);
            }.bind(this);
        },

        onExport: function () {
            var oTable = this.byId("idTable");
            var aExcelSet = this.getModel("local").getProperty("/Bom");
            var aExcelCol = [];
            var aTableCol = oTable.getColumns();
            for (var i = 0; i < aTableCol.length; i++) {
                if (aTableCol[i].getVisible()) {
                    var sLabelText = aTableCol[i].getAggregation("label").getText();
                    var sType, sTextAlign, sUnitProperty, bDelimiter, iScale;
                    var sFieldName = aTableCol[i].getAggregation("template").getBindingPath("text");
                    if (!sFieldName) {
                        sFieldName = aTableCol[i].getAggregation("template").mBindingInfos.value.parts[0].path;
                    }
                    switch (sFieldName) {
                        //  Date
                        case "HeaderValidityStartDate":
                            sType = sap.ui.export.EdmType.Date;
                            break;
                        //  Number 
                        case "ComponentQuantityInCompUoM":
                        case "BillOfMaterialSubItemQuantity":
                        case "NetWeight":
                        case "ComponentQuantityInBaseUoM":
                        case "BomHeaderQuantityInBaseUnit":
                            sType = sap.ui.export.EdmType.Number;
                            bDelimiter = true;
                            // iScale = 3;
                            sTextAlign = "End";
                            // sUnitProperty = "";
                            break;
                        default:
                            sType = sap.ui.export.EdmType.String;
                            sTextAlign = "Begin";
                            sUnitProperty = "";
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
                fileName: this.getModel("i18n").getResourceBundle().getText("BomFileName") + "_" + this.getCurrentDateTime() + ".xlsx"
            };
            // export excel file
            new Spreadsheet(oSettings).build();
        },

        onBeforeExport: function (oEvent) {
            var oSettings = oEvent.getParameter("exportSettings");
            var columns = oSettings.workbook.columns;
            columns.forEach(function (oColumn) {
                switch (oColumn.property) {
                    case "ComponentQuantityInCompUoM":
                    case "BillOfMaterialSubItemQuantity":
                    case "NetWeight":
                    case "ComponentQuantityInBaseUoM":
                        oColumn.type = sap.ui.export.EdmType.Number;
                        // oColumn.delimiter = true;
                        // oColumn.scale = 2;
                        break;
                    case "HeaderValidityStartDate":
                        oColumn.type = sap.ui.export.EdmType.Date;
                        break;
                }
            });
        },
    });
});
