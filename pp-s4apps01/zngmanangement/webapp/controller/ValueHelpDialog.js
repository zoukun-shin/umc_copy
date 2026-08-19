sap.ui.define([
    "sap/m/Label",
    "sap/ui/comp/filterbar/FilterGroupItem",
    "sap/m/SearchField",
    "sap/ui/table/Column",
    "sap/m/Text",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Input",
    "sap/m/BusyDialog",
    "sap/ui/core/Messaging"
], function (Label, FilterGroupItem, SearchField, UIColumn, Text, Filter, FilterOperator, Input, BusyDialog, Messaging) {
    "use strict";

    return {

        onValueHelpRequested: function (oEvent, that, sPath, aVHFields, aFilterFields, sTitle) {
            Messaging.removeAllMessages();
            that._oInput = oEvent.getSource();
            that._aVHFields = aVHFields;
            that._sValueHelpPath = sPath;
            if (aFilterFields) {
                that._aFilterFields = aFilterFields;
            } else {
                that._aFilterFields = aVHFields;
            }
            that._oBasicSearchField = new SearchField();
            that.loadFragment({
                name: "pp.zngmanangement.fragments.ValueHelpDialog"
            }).then(function (oDialog) {
                var oFilterBar = oDialog.getFilterBar();
                that._oVHD = oDialog;
                that.getView().addDependent(oDialog);

                oDialog.setTitle(that.getModel("i18n").getResourceBundle().getText(sTitle));
                oDialog.setKey(that._aVHFields[0]);
                if (that._aVHFields[0] === "ManufacturingOrder") {
                    oDialog.setDescriptionKey("Item");
                } else {
                    oDialog.setDescriptionKey(that._aVHFields[1]);
                }

                var aFilters = [];
                var headSet = that.getModel("local").getProperty("/NG_Header");
                if (sPath === "/ZC_ManufacturingOrderProductVH") {
                    if (headSet.Plant) {
                        aFilters.push(new Filter({
                            path: "ProductionPlant",
                            operator: FilterOperator.EQ,
                            value1: headSet.Plant
                        }));
                    }
                }
                if (sPath === "/I_StorageLocationStdVH" || sPath === "/ZC_ProductVH" || sPath === "/ZC_WorkCenterVH" || sPath === "/ZC_CustomerCompanyByPlant" || sPath === "/I_BatchStdVH") {
                    if (headSet.Plant) {
                        aFilters.push(new Filter({
                            path: "Plant",
                            operator: FilterOperator.EQ,
                            value1: headSet.Plant
                        }));
                    }
                }

                // ADD BEGIN BY XINLEI XU 2026/07/21 CN 需求 No.392
                var sInputPath = that._oInput.mBindingInfos.value.parts[0].path;
                if (sInputPath === "/ItemEdit/FGMaterial") {
                    aFilters.push(new Filter({
                        path: "ProductType",
                        operator: FilterOperator.EQ,
                        value1: "ZFRT"
                    }));
                }
                if (sPath === "/I_BatchStdVH") {
                    if (headSet.Material) {
                        aFilters.push(new Filter({
                            path: "Material",
                            operator: FilterOperator.EQ,
                            value1: headSet.Material
                        }));
                    }
                }
                // ADD END BY XINLEI XU 2026/07/21 CN 需求 No.392

                // Set filter group items
                that._aFilterFields.forEach(fieldName => {
                    if (fieldName !== "UUID") {
                        var oControl;
                        // MOD BEGIN BY XINLEI XU 2026/07/21 CN 需求 No.392
                        // var oFilterGroupItem = new FilterGroupItem({
                        //     groupName: "__$INTERNAL$",
                        //     visibleInFilterBar: true,
                        //     name: fieldName,
                        //     label: "{i18n>" + fieldName + "}"
                        // });
                        // oControl = new Input({ name: fieldName });
                        var sLabel = "";
                        if ((sPath === "/ZC_ProductVH" && (sInputPath === "/ItemEdit/RefMaterial" || sInputPath === "/ItemEdit/FGMaterial")) || sPath === "/ZC_ManufacturingOrderProductVH" || sPath === "/I_BatchStdVH") {
                            if (fieldName.includes("Material")) {
                                sLabel = "{i18n>" + fieldName + "1}";
                            } else {
                                sLabel = "{i18n>" + fieldName + "}";
                            }
                        } else {
                            sLabel = "{i18n>" + fieldName + "}";
                        }
                        var oFilterGroupItem = new FilterGroupItem({
                            groupName: "__$INTERNAL$",
                            visibleInFilterBar: true,
                            name: fieldName,
                            label: sLabel
                        });
                        if (sInputPath === "/ItemEdit/FGMaterial" && fieldName === "ProductType") {
                            oControl = new Input({ name: fieldName, value: "ZFRT" });
                        } else {
                            oControl = new Input({ name: fieldName });
                        }
                        // MOD END BY XINLEI XU 2026/07/21 CN 需求 No.392
                        oFilterGroupItem.setControl(oControl);
                        oFilterBar.addFilterGroupItem(oFilterGroupItem);
                    }
                });

                // Set Basic Search for FilterBar
                oFilterBar.setFilterBarExpanded(false);
                // oFilterBar.setBasicSearch(that._oBasicSearchField);

                // Trigger filter bar search when the basic search is fired
                that._oBasicSearchField.attachSearch(function () {
                    oFilterBar.search();
                });

                oDialog.getTableAsync().then(function (oTable) {
                    oTable.setModel(that.getModel());
                    // For Desktop and tabled the default table is sap.ui.table.Table
                    if (oTable.bindRows) {
                        oTable.setSelectionMode("Single");
                        oTable.setSelectionBehavior("Row");
                        // Bind rows to the ODataModel and add columns
                        oTable.bindAggregation("rows", {
                            path: sPath,
                            filters: aFilters,
                            parameters: { $count: true },
                            events: {
                                dataReceived: function () {
                                    oDialog.update();
                                }
                            }
                        });
                        var sWidth = "";
                        var sLabel = "";
                        that._aVHFields.forEach(fieldName => {
                            if ((sPath === "/ZC_ProductVH" && (sInputPath === "/ItemEdit/RefMaterial" || sInputPath === "/ItemEdit/FGMaterial")) || sPath === "/ZC_ManufacturingOrderProductVH" || sPath === "/I_BatchStdVH") {
                                if (fieldName.includes("Material")) {
                                    sLabel = "{i18n>" + fieldName + "1}";
                                } else {
                                    sLabel = "{i18n>" + fieldName + "}";
                                }
                            } else {
                                sLabel = "{i18n>" + fieldName + "}";
                            }
                            switch (fieldName) {
                                case "PlantName":
                                case "StorageLocationName":
                                case "CustomerName":
                                case "Material":
                                case "MaterialDescription":
                                    sWidth = "20rem";
                                    break;
                                default:
                                    sWidth = "10rem";
                                    break;
                            }
                            var oColumn = new UIColumn({
                                width: sWidth,
                                label: new Label({ text: sLabel }),
                                template: new Text({ wrapping: false, text: "{" + fieldName + "}" })
                            });
                            oColumn.data({
                                fieldName: fieldName
                            });
                            oTable.addColumn(oColumn);
                        });
                    }
                    oDialog.update();
                    oDialog.open();
                }.bind(that));
            }.bind(that));
        },

        onFilterBarSearch: function (oEvent) {
            var aNewFilters = [];
            var sSearchQuery = this._oBasicSearchField.getValue(),
                aSelectionSet = oEvent.getParameter("selectionSet");
            var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
                var sValue;
                if (oControl.getName() === "Type") {
                    sValue = oControl.getSelectedKey();
                } else {
                    sValue = oControl.getValue();
                }
                if (sValue) {
                    aResult.push(new Filter({
                        path: oControl.getName(),
                        operator: FilterOperator.Contains,
                        value1: sValue
                    }));
                }
                return aResult;
            }, []);
            if (sSearchQuery) {
                this._aVHFields.forEach(fieldName => {
                    aNewFilters.push(new Filter({ path: fieldName, operator: FilterOperator.Contains, value1: sSearchQuery }));
                });
                aFilters.push(new Filter({
                    filters: aNewFilters,
                    and: false
                }));
            }
            var headSet = this.getModel("local").getProperty("/NG_Header");
            if (this._sValueHelpPath === "/ZC_ManufacturingOrderProductVH") {
                if (headSet.Plant) {
                    aFilters.push(new Filter({
                        path: "ProductionPlant",
                        operator: FilterOperator.EQ,
                        value1: headSet.Plant
                    }));
                }
            }
            if (this._sValueHelpPath === "/I_StorageLocationStdVH" ||
                this._sValueHelpPath === "/ZC_ProductVH" ||
                this._sValueHelpPath === "/ZC_WorkCenterVH" ||
                this._sValueHelpPath === "/ZC_CustomerCompanyByPlant") {
                if (headSet.Plant) {
                    aFilters.push(new Filter({
                        path: "Plant",
                        operator: FilterOperator.EQ,
                        value1: headSet.Plant
                    }));
                }
            }

            // Fixed bug
            if (this._sValueHelpPath === "/I_Plant") {
                aFilters.push(new Filter({
                    path: "Plant",
                    operator: FilterOperator.NE,
                    value1: "XyxY"
                }));
            }

            var oFilter = new Filter({
                filters: aFilters,
                and: true
            });
            this._oVHD.getTableAsync().then(function (oTable) {
                if (oTable.bindRows) {
                    oTable.getBinding("rows").filter(oFilter);
                }
                // This method must be called after binding update of the table.
                this._oVHD.update();
            }.bind(this));
        },

        onValueHelpOkPress: function (oEvent) {
            var aTokens = oEvent.getParameter("tokens");
            var sKey = aTokens[0].getProperty("key").trim();
            var sText = "";
            if (aTokens[0].getProperty("text").includes("(")) {
                sText = aTokens[0].getProperty("text").split("(")[0].trim();
            }
            //--------------------------------------------------------------------------------
            var sInputPath = this._oInput.mBindingInfos.value.parts[0].path;
            if (sInputPath.includes("/")) {
                // head bind
                this.getModel("local").setProperty(sInputPath, sKey);
                if (aTokens[0].getProperty("text").includes("(")) {
                    this.getModel("local").setProperty(sInputPath + "Name", sText);
                } else {
                    this.getModel("local").setProperty(sInputPath + "Name", "");
                }

                var sODataPath;
                var sPlant = this.getModel("local").getProperty("/NG_Header/Plant");
                var sMaterialType = this.getModel("local").getProperty("/NG_Header/MaterialType");

                if (this._oSubmitDialog && this._oSubmitDialog.getButtons().length > 0) {
                    this._oSubmitDialog.getButtons()[0].setEnabled(sPlant.length > 0);
                }

                switch (sInputPath) {
                    case "/ItemEdit/ProductionOrder":
                        var sManufacturingOrder = sKey === undefined ? "" : sKey.padStart(10, '0');
                        var sItem = sText === undefined ? "0001" : sText.padStart(4, '0');
                        sODataPath = "/ZC_ManufacturingOrderProductVH" + "(ManufacturingOrder='" + sManufacturingOrder + "',Item='" + sItem + "',ProductionPlant='" + sPlant + "')";
                        break;
                    case "/ItemEdit/Material":
                    case "/ItemEdit/RefMaterial":
                    case "/ItemEdit/FGMaterial":
                        sODataPath = "/ZC_ProductVH(Material='" + encodeURIComponent(sKey) + "',Plant='" + sPlant + "')";
                        break;
                    case "/ItemEdit/WorkCenter":
                        sODataPath = "/ZC_WorkCenterVH(WorkCenter='" + sKey + "',Plant='" + sPlant + "')";
                        break;
                    case "/ItemEdit/Factor":
                        sODataPath = "/ZC_NG_FACTORVH(Factor='" + sKey + "')";
                        break;
                    case "/ItemEdit/Customer":
                        var sCustomer = /^[0-9]+$/.test(sKey) ? sKey.padStart(10, '0') : sKey;
                        sODataPath = "/ZC_CustomerCompanyByPlant(Customer='" + sCustomer + "',Plant='" + sPlant + "')";
                        break;
                    default:
                        this._oInput.setValueState("None");
                        break;
                }
                if (sODataPath) {
                    var _myBusyDialog = new BusyDialog();
                    _myBusyDialog.open();
                    this._CallODataV2("READ", sODataPath).then(function (context) {
                        _myBusyDialog.close();
                        if (context) {
                            this._oInput.setValueState("None");
                            switch (sInputPath) {
                                case "/ItemEdit/ProductionOrder":
                                    if (sMaterialType === "2") {
                                        // Assembly
                                        this.getModel("local").setProperty("/ItemEdit/Material", context["Product"]);
                                        this.getModel("local").setProperty("/ItemEdit/MaterialName", context["ProductDescription"]);
                                    } else {
                                        // Parts
                                        this.getModel("local").setProperty("/ItemEdit/Material", context["Material"]);
                                        this.getModel("local").setProperty("/ItemEdit/MaterialName", context["MaterialDescription"]);
                                    }
                                    this.getModel("local").setProperty("/ItemEdit/Assembly", context["Assembly"]);
                                    this.getModel("local").setProperty("/ItemEdit/WorkCenter", context["WorkCenter"]);
                                    this.getModel("local").setProperty("/ItemEdit/WorkCenterText", context["WorkCenterText"]);
                                    this.getModel("local").setProperty("/ItemEdit/BaseUnit", context["BaseUnit"]);
                                    break;
                                case "/ItemEdit/Material":
                                    this.getModel("local").setProperty("/ItemEdit/Material", context["Material"]);
                                    this.getModel("local").setProperty("/ItemEdit/MaterialName", context["MaterialDescription"]);
                                    this.getModel("local").setProperty("/ItemEdit/BaseUnit", context["BaseUnit"]);
                                    break;
                                // ADD BEGIN BY XINLEI XU 2026/07/21 CN 需求 No.392
                                case "/ItemEdit/RefMaterial":
                                    this.getModel("local").setProperty("/ItemEdit/RefMaterial", context["Material"]);
                                    break;
                                case "/ItemEdit/FGMaterial":
                                    this.getModel("local").setProperty("/ItemEdit/FGMaterial", context["Material"]);
                                    break;
                                // ADD END BY XINLEI XU 2026/07/21 CN 需求 No.392
                                case "/ItemEdit/WorkCenter":
                                    this.getModel("local").setProperty("/ItemEdit/WorkCenter", context["WorkCenter"]);
                                    this.getModel("local").setProperty("/ItemEdit/WorkCenterText", context["WorkCenterText"]);
                                    break;
                                case "/ItemEdit/Factor":
                                    this.getModel("local").setProperty("/ItemEdit/Factor", context["Factor"]);
                                    this.getModel("local").setProperty("/ItemEdit/FactorText", context["FactorText"]);
                                    break;
                                case "/ItemEdit/Customer":
                                    this.getModel("local").setProperty("/ItemEdit/Customer", context["Customer"]);
                                    this.getModel("local").setProperty("/ItemEdit/CustomerName", context["CustomerName"]);
                                    break;
                                default:
                                    break;
                            }
                        } else {
                            this._oInput.setValueState("Error");
                        }
                    }.bind(this), function (oError) {
                        _myBusyDialog.close();
                    }.bind(this));
                }
            }
            //--------------------------------------------------------------------------------
            this._oVHD.close();
        },

        onValueHelpCancelPress: function () {
            this._oVHD.close();
        },

        onValueHelpAfterClose: function () {
            this._oVHD.destroy();
        },

        handleChange: function (oEvent) {
            var sValue, sInputBindingPath, sPath, sODataPath;
            var _myBusyDialog = new BusyDialog();
            _myBusyDialog.open();
            this._oControl = oEvent.getSource();
            switch (this._oControl.getMetadata().getName()) {
                case "sap.m.Input":
                    sValue = this._oControl.getValue();
                    sInputBindingPath = this._oControl.mBindingInfos.value.parts[0].path;
                    sPath = this._oControl.mBindingInfos.suggestionRows.path;
                    break;
                default:
                    break;
            }
            var sPlant = this.getModel("local").getProperty("/NG_Header/Plant");
            var sMaterialType = this.getModel("local").getProperty("/NG_Header/MaterialType");
            switch (sPath) {
                case "/ZC_ManufacturingOrderProductVH":
                    var sManufacturingOrder = sValue.split('/')[0] === undefined ? "" : sValue.split('/')[0].padStart(10, '0');
                    var sItem = sValue.split('/')[1] === undefined ? "0001" : sValue.split('/')[1].padStart(4, '0');
                    sODataPath = sPath + "(ManufacturingOrder='" + sManufacturingOrder + "',Item='" + sItem + "',ProductionPlant='" + sPlant + "')";
                    break;
                case "/ZC_ProductVH":
                    sODataPath = sPath + "(Material='" + encodeURIComponent(sValue) + "',Plant='" + sPlant + "')";
                    break;
                case "/ZC_WorkCenterVH":
                    sODataPath = sPath + "(WorkCenter='" + sValue + "',Plant='" + sPlant + "')";
                    break;
                case "/ZC_NG_FACTORVH":
                    sODataPath = sPath + "(Factor='" + sValue + "')";
                    break;
                case "/ZC_CustomerCompanyByPlant":
                    var sCustomer = /^[0-9]+$/.test(sValue) ? sValue.padStart(10, '0') : sValue;
                    sODataPath = sPath + "(Customer='" + sCustomer + "',Plant='" + sPlant + "')";
                    break;
                default:
                    break;
            }
            this._oControl.setValueState("Error");
            if (sValue) {
                this._CallODataV2("READ", sODataPath).then(function (context) {
                    _myBusyDialog.close();
                    if (context) {
                        this._oControl.setValueState("None");
                        switch (sPath) {
                            case "/ZC_ManufacturingOrderProductVH":
                                if (sMaterialType === "2") {
                                    // Assembly
                                    this.getModel("local").setProperty("/ItemEdit/Material", context["Product"]);
                                    this.getModel("local").setProperty("/ItemEdit/MaterialName", context["ProductDescription"]);
                                } else {
                                    // Parts
                                    this.getModel("local").setProperty("/ItemEdit/Material", context["Material"]);
                                    this.getModel("local").setProperty("/ItemEdit/MaterialName", context["MaterialDescription"]);
                                }
                                this.getModel("local").setProperty("/ItemEdit/ProductionOrder", context["ManufacturingOrder"]);
                                this.getModel("local").setProperty("/ItemEdit/Assembly", context["Assembly"]);
                                this.getModel("local").setProperty("/ItemEdit/WorkCenter", context["WorkCenter"]);
                                this.getModel("local").setProperty("/ItemEdit/WorkCenterText", context["WorkCenterText"]);
                                this.getModel("local").setProperty("/ItemEdit/BaseUnit", context["BaseUnit"]);
                                break;
                            // DEL BEGIN BY XINLEI XU 2026/07/21 CN 需求 No.392
                            // case "/ZC_ProductVH":
                            //     this.getModel("local").setProperty("/ItemEdit/Material", context["Material"]);
                            //     this.getModel("local").setProperty("/ItemEdit/MaterialName", context["MaterialDescription"]);
                            //     this.getModel("local").setProperty("/ItemEdit/BaseUnit", context["BaseUnit"]);
                            //     break;
                            // DEL BEGIN BY XINLEI XU 2026/07/21 CN 需求 No.392
                            case "/ZC_WorkCenterVH":
                                this.getModel("local").setProperty("/ItemEdit/WorkCenter", context["WorkCenter"]);
                                this.getModel("local").setProperty("/ItemEdit/WorkCenterText", context["WorkCenterText"]);
                                break;
                            case "/ZC_NG_FACTORVH":
                                this.getModel("local").setProperty("/ItemEdit/Factor", context["Factor"]);
                                this.getModel("local").setProperty("/ItemEdit/FactorText", context["FactorText"]);
                                break;
                            case "/ZC_CustomerCompanyByPlant":
                                this.getModel("local").setProperty("/ItemEdit/Customer", context["Customer"]);
                                this.getModel("local").setProperty("/ItemEdit/CustomerName", context["CustomerName"]);
                                break;
                            default:
                                break;
                        }
                        // ADD BEGIN BY XINLEI XU 2026/07/21 CN 需求 No.392
                        switch (sInputBindingPath) {
                            case "/ItemEdit/Material":
                                this.getModel("local").setProperty("/ItemEdit/Material", context["Material"]);
                                this.getModel("local").setProperty("/ItemEdit/MaterialName", context["MaterialDescription"]);
                                this.getModel("local").setProperty("/ItemEdit/BaseUnit", context["BaseUnit"]);
                                break;
                            case "/ItemEdit/RefMaterial":
                                this.getModel("local").setProperty("/ItemEdit/RefMaterial", context["Material"]);
                                break;
                            case "/ItemEdit/FGMaterial":
                                this.getModel("local").setProperty("/ItemEdit/FGMaterial", context["Material"]);
                                break;
                            default:
                                break;
                        }
                        // ADD END BY XINLEI XU 2026/07/21 CN 需求 No.392
                    }
                }.bind(this), function (oError) {
                    _myBusyDialog.close();
                    switch (sPath) {
                        case "/ZC_ManufacturingOrderProductVH":
                            this.getModel("local").setProperty("/ItemEdit/Assembly", "");
                            break;
                        // DEL BEGIN BY XINLEI XU 2026/07/21 CN 需求 No.392    
                        // case "/ZC_ProductVH":
                        //     this.getModel("local").setProperty("/ItemEdit/MaterialName", "");
                        //     this.getModel("local").setProperty("/ItemEdit/BaseUnit", "");
                        //     break;
                        // DEL END BY XINLEI XU 2026/07/21 CN 需求 No.392
                        case "/ZC_WorkCenterVH":
                            this.getModel("local").setProperty("/ItemEdit/WorkCenterText", "");
                            break;
                        case "/ZC_NG_FACTORVH":
                            this.getModel("local").setProperty("/ItemEdit/FactorText", "");
                            break;
                        case "/ZC_CustomerCompanyByPlant":
                            this.getModel("local").setProperty("/ItemEdit/CustomerName", "");
                            break;
                        default:
                            break;
                    }
                    // ADD BEGIN BY XINLEI XU 2026/07/21 CN 需求 No.392
                    switch (sInputBindingPath) {
                        case "/ItemEdit/Material":
                            this.getModel("local").setProperty("/ItemEdit/MaterialName", "");
                            this.getModel("local").setProperty("/ItemEdit/BaseUnit", "");
                            break;
                        case "/ItemEdit/RefMaterial":
                            this.getModel("local").setProperty("/ItemEdit/RefMaterial", "");
                            break;
                        case "/ItemEdit/FGMaterial":
                            this.getModel("local").setProperty("/ItemEdit/FGMaterial", "");
                            break;
                        default:
                            break;
                    }
                    // ADD END BY XINLEI XU 2026/07/21 CN 需求 No.392
                }.bind(this));
            } else {
                _myBusyDialog.close();
                this._oControl.setValueState("None");
                switch (sPath) {
                    case "/ZC_ManufacturingOrderProductVH":
                        this.getModel("local").setProperty("/ItemEdit/Assembly", "");
                        break;
                    // DEL BEGIN BY XINLEI XU 2026/07/21 CN 需求 No.392
                    // case "/ZC_ProductVH":
                    //     this.getModel("local").setProperty("/ItemEdit/Material", "");
                    //     this.getModel("local").setProperty("/ItemEdit/MaterialName", "");
                    //     this.getModel("local").setProperty("/ItemEdit/BaseUnit", "");
                    //     break;
                    // DEL END BY XINLEI XU 2026/07/21 CN 需求 No.392
                    case "/ZC_WorkCenterVH":
                        this.getModel("local").setProperty("/ItemEdit/WorkCenter", "");
                        this.getModel("local").setProperty("/ItemEdit/WorkCenterText", "");
                        break;
                    case "/ZC_NG_FACTORVH":
                        this.getModel("local").setProperty("/ItemEdit/Factor", "");
                        this.getModel("local").setProperty("/ItemEdit/FactorText", "");
                        break;
                    case "/ZC_CustomerCompanyByPlant":
                        this.getModel("local").setProperty("/ItemEdit/Customer", "");
                        this.getModel("local").setProperty("/ItemEdit/CustomerName", "");
                        break;
                    default:
                        break;
                }
                // ADD BEGIN BY XINLEI XU 2026/07/21 CN 需求 No.392
                switch (sInputBindingPath) {
                    case "/ItemEdit/Material":
                        this.getModel("local").setProperty("/ItemEdit/MaterialName", "");
                        this.getModel("local").setProperty("/ItemEdit/BaseUnit", "");
                        break;
                    case "/ItemEdit/RefMaterial":
                        this.getModel("local").setProperty("/ItemEdit/RefMaterial", "");
                        break;
                    case "/ItemEdit/FGMaterial":
                        this.getModel("local").setProperty("/ItemEdit/FGMaterial", "");
                        break;
                    default:
                        break;
                }
                // ADD END BY XINLEI XU 2026/07/21 CN 需求 No.392
            }
        }
    };
});