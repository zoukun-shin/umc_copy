sap.ui.define([
    "./Base",
    "sap/ui/core/UIComponent",
    "sap/m/MessageBox",
	"sap/ui/core/date/UI5Date",
    "sap/ui/dom/includeScript"
], function (Base, UIComponent, MessageBox, UI5Date, includeScript) {
    "use strict";

    return Base.extend("pp.zipqcpinaimsheet.controller.Main", {
        onInit: function () {
            this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
            var oContextBinding = this.getView().getModel("Authority").bindContext("/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
                "$expand": "_AssignPlant,_AssignCompany,_AssignSalesOrg,_AssignPurchOrg,_AssignRole($expand=_UserRoleAccessBtn)"
            });

             this.onSelect();

            oContextBinding.requestObject().then(function (context) {
                var aAccessBtns = [],
                    aAllAccessBtns = [];
                if (context._AssignRole && context._AssignRole.length > 0) {
                    context._AssignRole.forEach(role => {
                        aAccessBtns.push(role._UserRoleAccessBtn);
                    });
                    aAllAccessBtns = aAccessBtns.flat();
                }
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zipqcpinaimsheet-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zipqcpinaimsheet-View")
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

        onSelect: function (oEvent) {
            var iSelectedIndex = this.byId("idRBG3").getSelectedIndex();
            if (iSelectedIndex===9) {
                this.byId("idVB1").setVisible(false);
                this.byId("idDP1").setEnabled(false);
                this.getModel("local").setProperty("/ValidityStartDate",UI5Date.getInstance());
            } else {
                this.byId("idVB1").setVisible(true);
                this.byId("idDP1").setEnabled(true);
            }
        },

        onsMrilterBarInitialized: function (oEvent) {
            var oSmartFilterBar = oEvent.getSource();
            oSmartFilterBar.setFilterData({
                BillOfMaterialVariant:'01'
            });
        },

        onExport: function () {
            var afilters = this.getFilters();
            if (afilters && afilters.length > 0) {
                this._CallODataV2("READ", "/IPQCPInAIMSheet", afilters, { "$top": 999999999 }, {}).then(function (oResponse) {
                    var aResults = oResponse.results;
                    if (aResults.length > 0) {
                        // var oRequestData = {
                        //     items: aResults
                        // }
                        //
                        // this._CallODataV2("ACTION", "/processLogic", [], {"Event": "Export", "Zzkey": JSON.stringify(oRequestData), "RecordUUID": ""}, {}).then(function (oResponse) {
                        //     if (oResponse.processLogic.RecordUUID) {
                        //         var sURL = this.getView().getModel("Print").getServiceUrl() + "PrintRecord(RecordUUID=" + oResponse.processLogic.RecordUUID + ",IsActiveEntity=true)/PDFContent";
                        //         sap.m.URLHelper.redirect(sURL, true);
                        //     }
                        // }.bind(this), function (oError) {
                        //     MessageBox.error(oError);
                        // }.bind(this));

                        // ExcelJS导出
                        this.exportExcel(aResults);
                    } else {
                        MessageBox.error(this.getModel("i18n").getResourceBundle().getText("noData"));
                    }
                }.bind(this), function (oError) {
                    MessageBox.error(oError);
                }.bind(this));
            }
        },

        exportExcel: async function (aData, sURL) {
            var bMpnSelected = this.byId("idCB2").getSelected();
            var iTemplateType = this.byId("idRBG3").getSelectedIndex();

            await this.loadLibs();
            var templateBuffer = await this.loadTemplate(bMpnSelected, iTemplateType);
            var workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(templateBuffer);
            var worksheet = workbook.getWorksheet(1);

            var templateRowNo = 8;
            var insertStartRow = templateRowNo + 1;
            var insertNum = aData.length - 1;
            var origPrintEndRow = 22; //表格最大打印行(可以比实际最大行大一些，避免因列数变动导致打印区域设置错误)
            var printEndCol = 20;     //表格最大打印列(可以比实际最大列大一些，避免因列数变动导致打印区域设置错误)

            // ======================
            // 1. 缓存所有合并单元格
            // ======================
            var mergeList = [];
            if (worksheet._merges) {
                Object.values(worksheet._merges).forEach(m => {
                    mergeList.push({
                        top: m.top,
                        bottom: m.bottom,
                        left: m.left,
                        right: m.right
                    });
                });
                // 循环逐个取消合并，避免报错
                Object.keys(worksheet._merges).forEach(key => {
                    try {
                        worksheet.unMergeCells(key);
                    } catch (e) {}
                });
            }

            // ======================
            // 2. 插入空行 + 模版行克隆
            // ======================
            if (insertNum > 0) {
                worksheet.spliceRows(insertStartRow, 0, ...Array(insertNum).fill([]));
                const sourceTplRow = worksheet.getRow(templateRowNo);

                for (let i = 0, j = 1; i < aData.length - 1; i++, j++) {
                    var targetRowNo = insertStartRow + i;
                    var targetRow = worksheet.getRow(targetRowNo);
                    this.cloneRow(sourceTplRow, targetRow, mergeList, templateRowNo, worksheet, j);
                }
            }

            // ======================
            //3. 修正所有下移后的合并单元格
            // ======================
            mergeList.forEach(item => {
                let newTop = item.top;
                let newBottom = item.bottom;
                if (item.top >= insertStartRow) {
                    newTop += insertNum;
                    newBottom += insertNum;
                }
                try {
                    worksheet.mergeCells(newTop, item.left, newBottom, item.right);
                } catch (e) {}
            });

            // ======================
            //4. 动态重置打印区域
            // ======================
            // 新打印结束行 = 原结束行 + 新增数据行数
            var newPrintEndRow = origPrintEndRow + insertNum;
            // 清空旧打印区域，重新设置 A1 ~ S(newPrintEndRow)
            worksheet.pageSetup.printArea = `$A$1:$${String.fromCharCode(64+printEndCol)}$${newPrintEndRow}`;
            // 可选：适配一页宽度打印
            worksheet.pageSetup.fitToPage = true;
            worksheet.pageSetup.fitToHeight = 0;

            // ======================
            //5. 填充数据
            // ======================
            //Filename
            var sFileName = "";
            switch (iTemplateType) {
                case 0:
                case 1:
                case 2:
                case 3:
                    if (iTemplateType===0) {    
                        sFileName = this.getModel("i18n").getResourceBundle().getText("SMT");
                    } else if(iTemplateType===1) {
                        sFileName = this.getModel("i18n").getResourceBundle().getText("SMTA");
                    } else if(iTemplateType===2) {
                        sFileName = this.getModel("i18n").getResourceBundle().getText("SMTB");
                    } else {
                        sFileName = this.getModel("i18n").getResourceBundle().getText("SMTC");
                    }
                    this.setExcelSMT(worksheet, aData, templateRowNo, bMpnSelected);
                    break;
                case 4:
                case 5:
                case 6:
                    if (iTemplateType===4) {    
                        sFileName = this.getModel("i18n").getResourceBundle().getText("JVK");
                    } else if(iTemplateType===5) {
                        sFileName = this.getModel("i18n").getResourceBundle().getText("RHS");
                    } else {
                        sFileName = this.getModel("i18n").getResourceBundle().getText("AVK");
                    }
                    this.setExcelAI(worksheet, aData, templateRowNo, bMpnSelected);
                    break;
                case 7:
                    sFileName = this.getModel("i18n").getResourceBundle().getText("FAT");
                    this.setExcelFAT(worksheet, aData, templateRowNo, bMpnSelected);
                    break;
                case 8:
                    sFileName = this.getModel("i18n").getResourceBundle().getText("OQC");
                    this.setExcelOQC(worksheet, aData, templateRowNo, bMpnSelected);
                    break;
                case 9:
                    sFileName = this.getModel("i18n").getResourceBundle().getText("AIM");
                    this.setExcelAIM(worksheet, aData, templateRowNo);
                    break;
                default:
                    break;
            }

            // 导出下载
            var buffer = await workbook.xlsx.writeBuffer();
            sFileName = sFileName + "_" + this.getCurrentDateTime() + ".xlsx";
            saveAs(new Blob([buffer]), sFileName);
        },

        setExcelSMT: function (worksheet, aData, templateRowNo, bMpnSelected) {
            var targetRow = worksheet.getRow(3);
                if (bMpnSelected) {
                    //客户
                    targetRow.getCell(3).value = aData[0].Customer || "";
                    //机种
                    targetRow.getCell(5).value = aData[0].Material || "";
                    //板面
                    targetRow.getCell(12).value = aData[0].HeaderBoard || "";
                    targetRow = worksheet.getRow(4);
                    //项目号
                    targetRow.getCell(3).value = aData[0].BOMHeaderText || "";
                    //BOM版本
                    targetRow.getCell(5).value = aData[0].RevisionLevel || "";
                    //日期
                    targetRow.getCell(12).value = aData[0].HeaderDate || "";
                } else {
                    //客户
                    targetRow.getCell(3).value = aData[0].Customer || "";
                    //机种
                    targetRow.getCell(5).value = aData[0].Material || "";
                    //板面
                    targetRow.getCell(11).value = aData[0].HeaderBoard || "";
                    targetRow = worksheet.getRow(4);
                    //项目号
                    targetRow.getCell(3).value = aData[0].BOMHeaderText || "";
                    //BOM版本
                    targetRow.getCell(5).value = aData[0].RevisionLevel || "";
                    //日期
                    targetRow.getCell(11).value = aData[0].HeaderDate || "";
                }

            var targetRowNo = templateRowNo;
            aData.forEach((data) => {
                var targetCellNo = 1;
                targetRow = worksheet.getRow(targetRowNo++);
                //序号
                targetRow.getCell(targetCellNo++).value = data.ItemNo || "";
                //位置
                targetRow.getCell(targetCellNo++).value = data.BOMSubItemInstallationPoint || "";
                //料号
                targetRow.getCell(targetCellNo++).value = data.BillOfMaterialComponent || "";
                //规格值
                targetRow.getCell(targetCellNo++).value = data.Detspecification || "";
                if (bMpnSelected) {
                    //制造商零件编号
                    targetRow.getCell(targetCellNo++).value = data.ProductManufacturerNumber || "";
                }
                //板面
                targetRow.getCell(targetCellNo++).value = data.ItemBoard || "";
            });
            targetRow.commit();
        },

        setExcelAI: function (worksheet, aData, templateRowNo, bMpnSelected) {
            var targetRow = worksheet.getRow(3);
                if (bMpnSelected) {
                    //客户
                    targetRow.getCell(3).value = aData[0].Customer || "";
                    //机种
                    targetRow.getCell(5).value = aData[0].Material || "";
                    //板面
                    targetRow.getCell(11).value = aData[0].HeaderBoard || "";
                    targetRow = worksheet.getRow(4);
                    //项目号
                    targetRow.getCell(3).value = aData[0].BOMHeaderText || "";
                    //BOM版本
                    targetRow.getCell(5).value = aData[0].RevisionLevel || "";
                    //日期
                    targetRow.getCell(11).value = aData[0].HeaderDate || "";
                } else {
                    //客户
                    targetRow.getCell(3).value = aData[0].Customer || "";
                    //机种
                    targetRow.getCell(5).value = aData[0].Material || "";
                    //板面
                    targetRow.getCell(10).value = aData[0].HeaderBoard || "";
                    targetRow = worksheet.getRow(4);
                    //项目号
                    targetRow.getCell(3).value = aData[0].BOMHeaderText || "";
                    //BOM版本
                    targetRow.getCell(5).value = aData[0].RevisionLevel || "";
                    //日期
                    targetRow.getCell(10).value = aData[0].HeaderDate || "";
                }

            var targetRowNo = templateRowNo;
            aData.forEach((data) => {
                var targetCellNo = 1;
                targetRow = worksheet.getRow(targetRowNo++);
                //序号
                targetRow.getCell(targetCellNo++).value = data.ItemNo || "";
                //位置
                targetRow.getCell(targetCellNo++).value = data.BOMSubItemInstallationPoint || "";
                //料号
                targetRow.getCell(targetCellNo++).value = data.BillOfMaterialComponent || "";
                //规格值
                targetRow.getCell(targetCellNo++).value = data.Detspecification || "";
                if (bMpnSelected) {
                    //制造商零件编号
                    targetRow.getCell(targetCellNo++).value = data.ProductManufacturerNumber || "";
                }
                //板面
                targetRow.getCell(targetCellNo++).value = data.ItemBoard || "";
            });
            targetRow.commit();
        },

        setExcelFAT: function (worksheet, aData, templateRowNo, bMpnSelected) {
            var targetRow = worksheet.getRow(3);
                if (bMpnSelected) {
                    //客户
                    targetRow.getCell(3).value = aData[0].Customer || "";
                    //机种
                    targetRow.getCell(5).value = aData[0].Material || "";
                    //RoHS,非RoHS,R&HF
                    if (aData[0].Code === '1') {
                        targetRow.getCell(11).value = "■";
                    } else if (aData[0].Code === '2') {
                        targetRow.getCell(16).value = "■";
                    } else if (aData[0].Code === '3') {
                        targetRow.getCell(18).value = "■";
                    }
                    targetRow = worksheet.getRow(5);
                    //项目号
                    targetRow.getCell(3).value = aData[0].BOMHeaderText || "";
                    //BOM版本
                    targetRow.getCell(5).value = aData[0].RevisionLevel || "";
                    //日期
                    targetRow.getCell(17).value = aData[0].HeaderDate || "";
                } else {
                    //客户
                    targetRow.getCell(3).value = aData[0].Customer || "";
                    //机种
                    targetRow.getCell(5).value = aData[0].Material || "";
                    //RoHS,非RoHS,R&HF
                    if (aData[0].Code === '1') {
                        targetRow.getCell(9).value = "■";
                    } else if (aData[0].Code === '2') {
                        targetRow.getCell(14).value = "■";
                    } else if (aData[0].Code === '3') {
                        targetRow.getCell(17).value = "■";
                    }
                    targetRow = worksheet.getRow(5);
                    //项目号
                    targetRow.getCell(3).value = aData[0].BOMHeaderText || "";
                    //BOM版本
                    targetRow.getCell(5).value = aData[0].RevisionLevel || "";
                    //日期
                    targetRow.getCell(15).value = aData[0].HeaderDate || "";
                }

            var targetRowNo = templateRowNo;
            aData.forEach((data) => {
                var targetCellNo = 1;
                targetRow = worksheet.getRow(targetRowNo++);
                //序号
                targetRow.getCell(targetCellNo++).value = data.ItemNo || "";
                //位置
                targetRow.getCell(targetCellNo++).value = data.BOMSubItemInstallationPoint || "";
                //料号
                targetRow.getCell(targetCellNo++).value = data.BillOfMaterialComponent || "";
                //规格值
                targetRow.getCell(targetCellNo++).value = data.Detspecification || "";
                if (bMpnSelected) {
                    //制造商零件编号
                    targetRow.getCell(targetCellNo++).value = data.ProductManufacturerNumber || "";
                }
                //板面
                targetRow.getCell(targetCellNo++).value = data.ItemBoard || "";
            });
            targetRow.commit();
        },

        setExcelOQC: function (worksheet, aData, templateRowNo, bMpnSelected) {
            var targetRow = worksheet.getRow(3);
                if (bMpnSelected) {
                    //客户
                    targetRow.getCell(3).value = aData[0].Customer || "";
                    //机种
                    targetRow.getCell(5).value = aData[0].Material || "";
                    //RoHS,非RoHS,R&HF
                    if (aData[0].Code === '1') {
                        targetRow.getCell(11).value = "■";
                    } else if (aData[0].Code === '2') {
                        targetRow.getCell(16).value = "■";
                    } else if (aData[0].Code === '3') {
                        targetRow.getCell(19).value = "■";
                    }
                    targetRow = worksheet.getRow(4);
                    //项目号
                    targetRow.getCell(3).value = aData[0].BOMHeaderText || "";
                    //BOM版本
                    targetRow.getCell(5).value = aData[0].RevisionLevel || "";
                    //日期
                    targetRow.getCell(12).value = aData[0].HeaderDate || "";
                } else {
                    //客户
                    targetRow.getCell(3).value = aData[0].Customer || "";
                    //机种
                    targetRow.getCell(5).value = aData[0].Material || "";
                    //RoHS,非RoHS,R&HF
                    if (aData[0].Code === '1') {
                        targetRow.getCell(9).value = "■";
                    } else if (aData[0].Code === '2') {
                        targetRow.getCell(15).value = "■";
                    } else if (aData[0].Code === '3') {
                        targetRow.getCell(18).value = "■";
                    }
                    targetRow = worksheet.getRow(4);
                    //项目号
                    targetRow.getCell(3).value = aData[0].BOMHeaderText || "";
                    //BOM版本
                    targetRow.getCell(5).value = aData[0].RevisionLevel || "";
                    //日期
                    targetRow.getCell(10).value = aData[0].HeaderDate || "";
                }

            var targetRowNo = templateRowNo;
            aData.forEach((data) => {
                var targetCellNo = 1;
                targetRow = worksheet.getRow(targetRowNo++);
                //序号
                targetRow.getCell(targetCellNo++).value = data.ItemNo || "";
                //位置
                targetRow.getCell(targetCellNo++).value = data.BOMSubItemInstallationPoint || "";
                //料号
                targetRow.getCell(targetCellNo++).value = data.BillOfMaterialComponent || "";
                //规格值
                targetRow.getCell(targetCellNo++).value = data.Detspecification || "";
                if (bMpnSelected) {
                    //制造商零件编号
                    targetRow.getCell(targetCellNo++).value = data.ProductManufacturerNumber || "";
                }
                //板面
                targetRow.getCell(targetCellNo++).value = data.ItemBoard || "";
            });
            targetRow.commit();
        },

        setExcelAIM: function (worksheet, aData, templateRowNo) {
            var targetRow = worksheet.getRow(2);
            //插件机
            targetRow.getCell(1).value = aData[0].Title || "";
            targetRow = worksheet.getRow(4);
            //制作日期
            targetRow.getCell(1).value = aData[0].HeaderDate || "";
            targetRow = worksheet.getRow(5);
            //客户
            targetRow.getCell(2).value = aData[0].Customer || "";
            //程序名称
            targetRow.getCell(5).value = aData[0].Material || "";
            //点数
            targetRow.getCell(8).value = aData[0].TotalPointQty || "";
            //ECO号码
            targetRow.getCell(10).value = aData[0].ChangeNumber || "";
            targetRow = worksheet.getRow(6);
            //文件号码
            targetRow.getCell(2).value = aData[0].BOMHeaderText || "";
            //机种名称
            targetRow.getCell(5).value = aData[0].Material || "";
            //版本
            targetRow.getCell(8).value = aData[0].RevisionLevel || "";
            //项目代码
            targetRow.getCell(10).value = aData[0].ProjectCode || "";

            var targetRowNo = templateRowNo;
            aData.forEach((data) => {
                targetRow = worksheet.getRow(targetRowNo++);
                //飞达 No
                targetRow.getCell(1).value = data.ItemNo || "";
                //部品
                targetRow.getCell(2).value = data.BillOfMaterialComponent || "";
                //规格值
                targetRow.getCell(4).value = data.Detspecification || "";
                //用量
                targetRow.getCell(8).value = data.ItemPointQty || "";
                //位置
                targetRow.getCell(9).value = data.BOMSubItemInstallationPoint || "";
            });
            targetRow.commit();
        },

        loadTemplate: async function (bMpnSelected, iTemplateType) {
            // ======================
            //  后端OData URL路径加载
            // ======================
            var sTemplateType = "", sLanguage = "", sFilename = "", aFilters = [];
            switch (iTemplateType) {
                case 0:
                case 1:
                case 2:
                case 3:
                    if(!bMpnSelected) {    
                        sTemplateType = "SMT01";
                    } else {
                        sTemplateType = "SMT02";
                    }
                    break;
                case 4:
                case 5:
                case 6:
                    if(!bMpnSelected) {    
                        sTemplateType = "AI01";
                    } else {
                        sTemplateType = "AI02";
                    }
                    break;
                case 7:
                    if(!bMpnSelected) {    
                        sTemplateType = "FAT01";
                    } else {
                        sTemplateType = "FAT02";
                    }
                    break;
                case 8:
                    if(!bMpnSelected) {    
                        sTemplateType = "OQC01";
                    } else {
                        sTemplateType = "OQC02";
                    }
                    break;
                case 9: 
                    sTemplateType = "AIM";
                    break;
                default:
                    break;
            }

            sLanguage = sap.ui.getCore().getConfiguration().getLanguage().substring(0, 2).toUpperCase();
            sFilename = "ZDOWNLOAD_IPQCPI_N_AIM_SHEET_" + sTemplateType + "_" + sLanguage;
            aFilters.push(new sap.ui.model.Filter("Object", sap.ui.model.FilterOperator.EQ, sFilename));
            var oModel = this.getOwnerComponent().getModel("Attach");
            var oBinding = oModel.bindList("/Configuration",null,null,aFilters);
            var aContexts = await oBinding.requestContexts(0, 1);
            if (!aContexts.length) {
                MessageBox.error(this.getModel("i18n").getResourceBundle().getText("noTemplate"));
                throw new Error(this.getModel("i18n").getResourceBundle().getText("noTemplate"));
            }

            var oData = aContexts[0].getObject();
            var sMimeType = oData.TemplateMimeType;
            var sPath = aContexts[0].sPath.substring(1);
            var sTemplateUrl = oModel.getServiceUrl() + sPath + "/TemplateContent";

            // 后端OData URL
            var response = await fetch(sTemplateUrl, {
                credentials: "include",
                method: "GET",
                headers: {
                    "Content-Type": sMimeType,
                    "Accept": sMimeType
                }
            });

            return await response.arrayBuffer();
        },

        loadTemplateLocal: async function (bMpnSelected, iTemplateType) {
            // ======================
            //  本地UI5 URL路径加载（/home/user/projects/UMC_UI5/pp-s4apps01/zipqcpinaimsheet/webapp/template）
            // ======================
            var sTemplateUrl = "";
            switch (iTemplateType) {
                case 0:
                case 1:
                case 2:
                case 3:
                    if(!bMpnSelected) {    
                        sTemplateUrl = "pp/zipqcpinaimsheet/template/SMT01.xlsx";
                    } else {
                        sTemplateUrl = "pp/zipqcpinaimsheet/template/SMT02.xlsx";
                    }
                    break;
                case 4:
                case 5:
                case 6:
                    if(!bMpnSelected) {    
                        sTemplateUrl = "pp/zipqcpinaimsheet/template/AI01.xlsx";
                    } else {
                        sTemplateUrl = "pp/zipqcpinaimsheet/template/AI02.xlsx";
                    }
                    break;
                case 7:
                    if(!bMpnSelected) {    
                        sTemplateUrl = "pp/zipqcpinaimsheet/template/FAT01.xlsx";
                    } else {
                        sTemplateUrl = "pp/zipqcpinaimsheet/template/FAT02.xlsx";
                    }
                    break;
                case 8:
                    if(!bMpnSelected) {    
                        sTemplateUrl = "pp/zipqcpinaimsheet/template/OQC01.xlsx";
                    } else {
                        sTemplateUrl = "pp/zipqcpinaimsheet/template/OQC02.xlsx";
                    }
                    break;
                case 9: 
                    sTemplateUrl = "pp/zipqcpinaimsheet/template/AIM.xlsx";
                    break;
                default:
                    break;
            }

            // 本地UI5 URL
            const response = await fetch(
                sap.ui.require.toUrl(
                    sTemplateUrl
                )
            );

            return await response.arrayBuffer();
        },

        loadLibs: async function () {
            if (window.ExcelJS && window.saveAs) {
                return;
            }

            await includeScript({
                url: sap.ui.require.toUrl("pp/zipqcpinaimsheet/lib/exceljs.min.js")
            });

            await includeScript({
                url: sap.ui.require.toUrl("pp/zipqcpinaimsheet/lib/FileSaver.min.js")
            });
        },

        cloneRow: function(templateRow, targetRow, mergeList, templateRowNo, worksheet, j) {
            targetRow.height = templateRow.height;
            targetRow.hidden = templateRow.hidden;
            targetRow.outlineLevel = templateRow.outlineLevel;

            templateRow.eachCell({ includeEmpty: true },(cell, colNumber) => {
                const newCell = targetRow.getCell(colNumber);
                // 复制样式
                newCell.style = JSON.parse(JSON.stringify(cell.style));
                
                // 复制格式
                newCell.numFmt = cell.numFmt;

                // 复制边框
                if (cell.border) {
                    newCell.border = JSON.parse(JSON.stringify(cell.border));
                }

                // 复制填充
                if (cell.fill) {
                    newCell.fill = JSON.parse(JSON.stringify(cell.fill));
                }

                // 复制对齐
                if (cell.alignment) {
                    newCell.alignment = JSON.parse(JSON.stringify(cell.alignment));
                }

                // 复制字体
                if (cell.font) {
                    newCell.font = JSON.parse(JSON.stringify(cell.font));
                }
            });

            // 复制合并单元格（读取模版行的合并单元格配置，并在新插入的行上重新创建合并单元格）
            var templateList = mergeList.filter(item => item.top === templateRowNo);
            templateList.forEach(item => {
                try {
                    worksheet.mergeCells(item.top+j, item.left, item.bottom+j, item.right);
                } catch (e) {}
            });
        },

        getFilters: function () {
            var filters = this.byId("idSmartFilterBar").getFilters();
            if (!filters) {
                filters = [];
            }

            var oSmartFilterBar = this.byId("idSmartFilterBar");
            var sPlant = oSmartFilterBar.getFilterData().Plant;
            var sMaterial = oSmartFilterBar.getFilterData().Material;
            var sBillOfMaterialVariant = oSmartFilterBar.getFilterData().BillOfMaterialVariant;
            var sFieldName = '';

            if (!sPlant) {
                sFieldName = this.getView().getModel("i18n").getResourceBundle().getText("Plant");
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("filterMandatory",[sFieldName]));
                return filters = [];
            }

            if (!sMaterial) {
                sFieldName = this.getView().getModel("i18n").getResourceBundle().getText("Material");
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("filterMandatory",[sFieldName]));
                return filters = [];
            }

            if (!sBillOfMaterialVariant) {
                sFieldName = this.getView().getModel("i18n").getResourceBundle().getText("BillOfMaterialVariant");
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("filterMandatory",[sFieldName]));
                return filters = [];
            }

            var aAuthorityPlantSet = this.getView().getModel("local").getProperty("/authorityCheck/data/PlantSet");
            if (!aAuthorityPlantSet.some(data => data.Plant === sPlant)) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("noAuthorityPlant", [sPlant]));    
                return filters = [];
            }

            var sDate = this.getModel("local").getProperty("/ValidityStartDate");
            if (sDate) {
                //替换成0时区，而不是转化成0时区（为了保持日期不变）
                var oUTCDate = this.converttoUTCDateTime(sDate);
                var oValidityStartDate = new sap.ui.model.Filter({
                    path: "ValidityStartDate",
                    operator: "EQ",
                    value1: oUTCDate
                });
                filters.push(oValidityStartDate);
            };

            var bSelected = this.byId("idCB1").getSelected();
            var oDisplayPMN = new sap.ui.model.Filter({
                path: "DisplayPMN",
                operator: "EQ",
                value1: bSelected
            });
            filters.push(oDisplayPMN);

            bSelected = this.byId("idCB2").getSelected();
            var oDisplayMPN = new sap.ui.model.Filter({
                path: "DisplayMPN",
                operator: "EQ",
                value1: bSelected
            });
            filters.push(oDisplayMPN);

            bSelected = this.byId("idCB3").getSelected();
            var oToBOMHistory = new sap.ui.model.Filter({
                path: "ToBOMHistory",
                operator: "EQ",
                value1: bSelected
            });
            filters.push(oToBOMHistory);

            var iSelectedIndex = this.byId("idRBG1").getSelectedIndex();
            var oDiscOrFollowUp = new sap.ui.model.Filter({
                path: "DiscOrFollowUp",
                operator: "EQ",
                value1: iSelectedIndex
            });
            filters.push(oDiscOrFollowUp);

            iSelectedIndex = this.byId("idRBG2").getSelectedIndex();
            var oPriorityOrPercent = new sap.ui.model.Filter({
                path: "PriorityOrPercent",
                operator: "EQ",
                value1: iSelectedIndex
            });
            filters.push(oPriorityOrPercent);

            iSelectedIndex = this.byId("idRBG3").getSelectedIndex();
            var oTemplateType = new sap.ui.model.Filter({
                path: "TemplateType",
                operator: "EQ",
                value1: iSelectedIndex
            });
            filters.push(oTemplateType);

            return filters;
        }
    });
});
