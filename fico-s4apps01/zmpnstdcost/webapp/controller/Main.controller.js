sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
],
    function (Base, formatter, Filter, FilterOperator, BusyDialog, MessageBox) {
        "use strict";

        return Base.extend("fico.zmpnstdcost.controller.Main", {
            formatter: formatter,

            onInit: function () {
                this._LocalData = this.getOwnerComponent().getModel("local");
                this._oDataModel = this.getOwnerComponent().getModel();
                this._BusyDialog = new BusyDialog();
                this.getRouter().getRoute("Main").attachMatched(this._initialize, this);
            },

            _initialize: function () {
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
                    if (!aAllAccessBtns.some(btn => btn.AccessId === "zmpnstdcost-View")) {
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
                            View: aAllAccessBtns.some(btn => btn.AccessId === "zmpnstdcost-View"),
                            Change: aAllAccessBtns.some(btn => btn.AccessId === "zmpnstdcost-Change")
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

            onButtonSelect: function (oEvent) {
                 var sOption1 = this.byId("Option1").getSelected();
                 if (sOption1 === true) {
                     this.getView().getModel("local").setProperty("/showB", false);
                 } else {
                     this.getView().getModel("local").setProperty("/showB", true);
                 }

                 // 查询模式：物料非必输；更新模式：物料必输
                 this._setProductMandatory(sOption1 !== true);
            },

            onAfterRendering: function (oEvent) {
                var bOption1Selected = this.byId("Option1").getSelected();
                if (bOption1Selected === true) {
                    setTimeout(() => {
                        this.getView().getModel("local").setProperty("/showB", false);
                    }, 100);
                } else {
                    setTimeout(() => {
                        this.getView().getModel("local").setProperty("/showB", true);
                    }, 100);
                }

                setTimeout(() => {
                    this._setProductMandatory(bOption1Selected !== true);
                }, 100);

            },

            /**
             * 切换物料过滤字段的必输状态
             * 必输时 SmartFilterBar 自己会在点【执行】时拦截并提示，不会发起取数
             * @param {boolean} bMandatory 是否必输
             */
            _setProductMandatory: function (bMandatory) {
                var oSFB = this.byId("SFBMPNSTDCost");
                if (!oSFB) {
                    return;
                }
                var oItem = oSFB.determineFilterItemByName("OwninventoryManagedProduct");
                if (!oItem) {
                    // 元数据未加载完时 determineFilterItemByName 取不到，兜底再找一次
                    oItem = (oSFB.getAllFilterItems() || []).find(function (o) {
                        return o.getName() === "OwninventoryManagedProduct";
                    });
                }
                if (oItem) {
                    oItem.setMandatory(bMandatory);
                }
            },

            /**
             * 物料过滤条件是否已输入
             * 单值时 getFilterData 返回字符串，多值时返回 {value, items, ranges}
             * @returns {boolean} 已输入返回true
             */
            _hasProductFilter: function () {
                var oFilterData = this.byId("SFBMPNSTDCost").getFilterData() || {};
                var vProduct = oFilterData.OwninventoryManagedProduct;
                if (!vProduct) {
                    return false;
                }
                if (typeof vProduct === "string") {
                    return vProduct.trim() !== "";
                }
                return !!(vProduct.value && String(vProduct.value).trim() !== "")
                    || (Array.isArray(vProduct.items) && vProduct.items.length > 0)
                    || (Array.isArray(vProduct.ranges) && vProduct.ranges.length > 0);
            },

            onBeforeRebindTable: function (oEvent) {
                var mBindingParams = oEvent.getParameter("bindingParams");

                // 每次重新取数前，丢弃客户端未提交的修改。
                // onChange 里用 setProperty 回写的 Status/Message 在 OData V2 模型中
                // 是 pending change，刷新时不会被服务端返回的空值覆盖，
                // 不 reset 的话上次【修改】的消息会一直残留在表格上。
                if (this._oDataModel.hasPendingChanges()) {
                    this._oDataModel.resetChanges();
                }

                var sPlant = this.byId("SFBMPNSTDCost").getFilterData().Plant;
                var aAuthorityPlantSet = this.getModel("local").getProperty("/authorityCheck/data/PlantSet");
                if (!aAuthorityPlantSet.some(data => data.Plant === sPlant)) {
                    // 无该工厂权限：取消本次绑定，表格不去取数
                    mBindingParams.preventTableBind = true;
                    MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityPlant", [sPlant]));
                    return;
                }

                var bOption2 = this.byId("Option2").getSelected();
                var oTable = this.byId("Table_MPNSTDCost");

                // 本次数据列，根据Option2控制显示
                var aCurrentCols = [
                    "CurrentPriceBeforeMarkup",
                    "CurrentMarkupPercentage",
                    "CurrentChangedPrice",
                    "CurrentPriceUnit",
                    "CurrentPurchasingInfoRecord",
                    "CurrentSupplier",
                    "CurrentValidityDate",
                    "Currency"
                ];

                aCurrentCols.forEach(function (sColId) {
                    var oColumn = oTable.getColumns().find(c => c.getId().includes(sColId));
                    if (oColumn) {
                        oColumn.setVisible(bOption2);
                    }
                });
            },

            onChange: function (oEvent) {
                var that = this;
                var bEvent = "CHANGE";

                // 更新必须指定物料。
                // 挡住这种情况：先在查询模式不带物料取数，再切到更新模式对整个工厂批量更新
                if (!this._hasProductFilter()) {
                    MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("mandatoryProduct"));
                    return;
                }

                let postDocs = this.preparePostBody();
                this._BusyDialog.open();
                var aPromise = [];
                aPromise.push(this.postAction(postDocs, bEvent));

                Promise.all(aPromise).then((oData) => {
  
                        oData.forEach((item) => {
                            let result = JSON.parse(item["processLogic"].Zzkey);
                            //that.getView().byId("SFBMPNSTDCost").search();
                            result.forEach(function (line) {
                                let sKey = `/MPNSTDCost(Plant='${line.PLANT}',OwninventoryManagedProduct='${line.OWNINVENTORYMANAGEDPRODUCT}',Product='${line.PRODUCT}')`;
                                this._oDataModel.setProperty(sKey + "/Status", line.STATUS);
                                this._oDataModel.setProperty(sKey + "/Message", line.MESSAGE); 
         
                            }, this);                            
                        });

    
                }).catch((error) => {
                    MessageBox.error(error.message);
                }).finally(() => {
                    this._BusyDialog.close();
                });


            },
            preparePostBody: function () {
                var that = this;
                var listItems = this.byId("Table_MPNSTDCost").getSelectedIndices(); // get selected rows
                var selectedRows = [];
                listItems.forEach((item) => {
                    var sPath = this.byId("Table_MPNSTDCost").getContextByIndex(item).getPath();
                    var oRow = this.getModel().getObject(sPath);
                    delete oRow.__metadata;
                    //selectedRows.push(this.byId("Table_MPNSTDCost").getContextByIndex(item));
                    selectedRows.push(oRow);
                });

                let postDocs = [JSON.stringify(selectedRows)];
                return postDocs;
            },

            postAction: function (postData,bEvent) {
                return new Promise(
                    function (resolve, reject) {
                        var mParameter = {
                            success: function (oData, response) {
                                resolve(oData);
                            },
                            error: function (oError) {
                                reject(oError);
                            },
                            method: "POST",
                            urlParameters: {
                                Zzkey: postData,
                                Event: bEvent
                            }
                        };
                        // Deep Create
                        this.getModel().callFunction("/processLogic", mParameter);
                    }.bind(this)

                );

            } 

           
        });
    });