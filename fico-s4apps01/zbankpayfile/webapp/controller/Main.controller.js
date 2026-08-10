sap.ui.define([
    "./Base",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/BusyDialog",
    "sap/m/MessageBox",
    "sap/ui/export/Spreadsheet",
    "sap/ui/export/library"
], function (Base, formatter, Filter, FilterOperator, BusyDialog, MessageBox, Spreadsheet, exportLibrary) {
    "use strict";

    const EDM = exportLibrary.EdmType;

    // 各银行模板定义: name=文件名/表头用, columns=导出列, buildRow=汇总行到模板行的映射
    // 金额按 供应商+币别 汇总后填入, 空字符串列为模板要求默认为空的字段
    const BANK_FORMATS = {
        "1": {
            name: "广发银行",
            columns: [
                { label: "付款账号", property: "f1", type: EDM.String },
                { label: "付款方户名", property: "f2", type: EDM.String },
                { label: "收款账号", property: "f3", type: EDM.String },
                { label: "收款账户户名", property: "f4", type: EDM.String },
                { label: "收款账户开户行", property: "f5", type: EDM.String },
                { label: "联行号", property: "f6", type: EDM.String },
                { label: "转账类型(1:行外交易 0:行内交易)", property: "f7", type: EDM.String },
                { label: "收款账户类型(0:企业 1:个人)", property: "f8", type: EDM.String },
                { label: "交易金额", property: "f9", type: EDM.Number },
                { label: "网银备忘", property: "f10", type: EDM.String },
                { label: "备注", property: "f11", type: EDM.String },
                { label: "附言", property: "f12", type: EDM.String }
            ],
            buildRow: function (oRow, fAmount, iSeq, fnDate) {
                return {
                    f1: oRow.PayerAccountNumber,
                    f2: oRow.PayerAccountHolder,
                    f3: oRow.VendorBankAccount,
                    f4: oRow.VendorBankAccountHolder,
                    f5: oRow.VendorBankName,
                    f6: oRow.VendorBankNumber,
                    f7: oRow.TransferType,
                    f8: oRow.ReceivingAccountType,
                    f9: fAmount,
                    f10: "",
                    f11: oRow.Remarks,
                    f12: ""
                };
            }
        },
        "2": {
            name: "中国银行",
            columns: [
                { label: "付款人账号", property: "f1", type: EDM.String },
                { label: "收款人账号", property: "f2", type: EDM.String },
                { label: "收款人户名", property: "f3", type: EDM.String },
                { label: "收款人开户行", property: "f4", type: EDM.String },
                { label: "收款行CNAPS行号", property: "f5", type: EDM.String },
                { label: "收款行清算行号", property: "f6", type: EDM.String },
                { label: "收款人类型", property: "f7", type: EDM.String },
                { label: "付款金额", property: "f8", type: EDM.Number },
                { label: "付费账号", property: "f9", type: EDM.String },
                { label: "指定付款日期", property: "f10", type: EDM.String },
                { label: "用途", property: "f11", type: EDM.String },
                { label: "客户业务编号", property: "f12", type: EDM.String },
                { label: "收款人Email", property: "f13", type: EDM.String },
                { label: "交易处理方式", property: "f14", type: EDM.String }
            ],
            buildRow: function (oRow, fAmount, iSeq, fnDate) {
                return {
                    f1: oRow.PayerAccountNumber,
                    f2: oRow.VendorBankAccount,
                    f3: oRow.VendorBankAccountHolder,
                    f4: oRow.VendorBankName,
                    f5: "",
                    f6: "",
                    f7: "单位",
                    f8: fAmount,
                    f9: "",
                    f10: fnDate(oRow.PaymentDate, ""),
                    f11: oRow.Remarks,
                    f12: "",
                    f13: "",
                    f14: ""
                };
            }
        },
        "3": {
            name: "工商银行",
            columns: [
                { label: "币种", property: "f1", type: EDM.String },
                { label: "日期", property: "f2", type: EDM.String },
                { label: "明细标志", property: "f3", type: EDM.String },
                { label: "顺序号", property: "f4", type: EDM.Number },
                { label: "付款账号开户行", property: "f5", type: EDM.String },
                { label: "付款账号/卡号", property: "f6", type: EDM.String },
                { label: "付款账号名称/卡名称", property: "f7", type: EDM.String },
                { label: "收款账号开户行", property: "f8", type: EDM.String },
                { label: "收款账号省份", property: "f9", type: EDM.String },
                { label: "收款账号地市", property: "f10", type: EDM.String },
                { label: "收款账号地区码", property: "f11", type: EDM.String },
                { label: "收款账号", property: "f12", type: EDM.String },
                { label: "收款账号名称", property: "f13", type: EDM.String },
                { label: "金额", property: "f14", type: EDM.Number },
                { label: "汇款用途", property: "f15", type: EDM.String },
                { label: "备注信息", property: "f16", type: EDM.String },
                { label: "汇款方式", property: "f17", type: EDM.String },
                { label: "收款账户短信通知手机号码", property: "f18", type: EDM.String },
                { label: "自定义序号", property: "f19", type: EDM.String },
                { label: "预先审批编号", property: "f20", type: EDM.String }
            ],
            buildRow: function (oRow, fAmount, iSeq, fnDate) {
                return {
                    f1: "RMB",
                    f2: fnDate(oRow.PaymentDate, ""),
                    f3: "",
                    f4: iSeq,
                    f5: oRow.HouseBankName,
                    f6: oRow.PayerAccountNumber,
                    f7: oRow.PayerAccountHolder,
                    f8: oRow.VendorBankName,
                    f9: oRow.BankProvince,
                    f10: oRow.BankCity,
                    f11: oRow.TransferType === "0" ? "0200" : "0000",
                    f12: oRow.VendorBankAccount,
                    f13: oRow.VendorBankAccountHolder,
                    f14: fAmount,
                    f15: oRow.Remarks,
                    f16: "",
                    f17: "0",
                    f18: "",
                    f19: "",
                    f20: ""
                };
            }
        },
        "4": {
            name: "瑞穗银行",
            columns: [
                { label: "付款人名称", property: "f1", type: EDM.String },
                { label: "付款人账号", property: "f2", type: EDM.String },
                { label: "支付方式", property: "f3", type: EDM.String },
                { label: "收款人账号", property: "f4", type: EDM.String },
                { label: "收款人名称", property: "f5", type: EDM.String },
                { label: "收款人开户行名称", property: "f6", type: EDM.String },
                { label: "金额", property: "f7", type: EDM.Number },
                { label: "用途", property: "f8", type: EDM.String },
                { label: "备注", property: "f9", type: EDM.String },
                { label: "付款日期", property: "f10", type: EDM.String },
                { label: "收款人类型", property: "f11", type: EDM.String },
                { label: "收款人常驻国家（地区）代码", property: "f12", type: EDM.String },
                { label: "交易编码", property: "f13", type: EDM.String },
                { label: "交易附言", property: "f14", type: EDM.String }
            ],
            buildRow: function (oRow, fAmount, iSeq, fnDate) {
                return {
                    f1: oRow.PayerAccountHolder,
                    f2: oRow.PayerAccountNumber,
                    f3: "电汇",
                    f4: oRow.VendorBankAccount,
                    f5: oRow.VendorBankAccountHolder,
                    f6: oRow.VendorBankName,
                    f7: fAmount,
                    f8: oRow.Remarks,
                    f9: "",
                    f10: fnDate(oRow.PaymentDate, "-"),
                    f11: "对公",
                    f12: "",
                    f13: "",
                    f14: ""
                };
            }
        }
    };

    return Base.extend("fico.zbankpayfile.controller.Main", {
        formatter: formatter,

        onInit: function () {
            this._LocalData = this.getOwnerComponent().getModel("local");
            this._oDataModel = this.getOwnerComponent().getModel();
            this._BusyDialog = new BusyDialog();
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);
        },

        _initialize: function () {
            // 指定付款日期默认当日
            var oPayDate = this.byId("idPaymentDate");
            if (oPayDate && !oPayDate.getDateValue()) {
                oPayDate.setDateValue(new Date());
            }

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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "zbankpayfile-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "zbankpayfile-View"),
                        Download: aAllAccessBtns.some(btn => btn.AccessId === "zbankpayfile-Download")
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

        onSearch: function () {
        },

        // SFB 字段生成完毕后设置初始状态, 数据源默认1时付款运行日期/ID不可用
        onSFBInitialise: function () {
            this._setPaymentRunFieldsEnabled(this.byId("DataSourceSelect").getSelectedKey() === "2");
        },

        // 数据源切换: 付款运行日期/ID只有付款建议可用
        onDataSourceChange: function () {
            this._setPaymentRunFieldsEnabled(this.byId("DataSourceSelect").getSelectedKey() === "2");
        },

        _setPaymentRunFieldsEnabled: function (bEnabled) {
            var oRunDate = this.byId("idPaymentRunDate");
            if (oRunDate) {
                oRunDate.setEnabled(bEnabled);
                if (!bEnabled) { oRunDate.setValue(""); }
            }
            var oSFB = this.byId("SFBBankPayFile");
            try {
                var oRunId = oSFB && oSFB.determineControlByName && oSFB.determineControlByName("PaymentRunID");
                if (oRunId && oRunId.setEnabled) {
                    oRunId.setEnabled(bEnabled);
                    if (!bEnabled) {
                        if (oRunId.setTokens) { oRunId.setTokens([]); }
                        if (oRunId.setValue) { oRunId.setValue(""); }
                    }
                }
            } catch (e) { /* 控件未渲染时忽略 */ }
        },

        onBeforeRebindTable: function (oEvent) {
            var mBindingParams = oEvent.getParameter("bindingParams");

            if (this._oDataModel.hasPendingChanges()) {
                this._oDataModel.resetChanges();
            }

            if (!this._checkCompanyAuthority()) {
                mBindingParams.preventTableBind = true;
                return;
            }

            var sDataSource = this.byId("DataSourceSelect").getSelectedKey() || "1";
            this._removeFilterByPath(mBindingParams.filters, "DataSource");
            mBindingParams.filters.push(new Filter("DataSource", FilterOperator.EQ, sDataSource));

            // 付款运行日期/ID只对数据源=付款建议生效
            if (sDataSource === "2") {
                var oRunDate = this.byId("idPaymentRunDate").getDateValue();
                if (oRunDate) {
                    mBindingParams.filters.push(new Filter("PaymentRunDate", FilterOperator.EQ, oRunDate));
                }
            } else {
                this._removeFilterByPath(mBindingParams.filters, "PaymentRunID");
                this._removeFilterByPath(mBindingParams.filters, "PaymentRunDate");
            }

            // AP过账日期区间
            var oPostingDate = this.byId("idPostingDate");
            if (oPostingDate && oPostingDate.getDateValue()) {
                var oFrom = oPostingDate.getDateValue();
                var oTo = oPostingDate.getSecondDateValue() || oFrom;
                mBindingParams.filters.push(new Filter("PostingDate", FilterOperator.BT, oFrom, oTo));
            }

            // 到期日 <= 屏幕输入值
            var oDueDate = this.byId("idNetDueDate").getDateValue();
            if (oDueDate) {
                mBindingParams.filters.push(new Filter("NetDueDate", FilterOperator.LE, oDueDate));
            }

            // 指定付款日期, 未输入时默认当日
            var oPayDatePicker = this.byId("idPaymentDate");
            var oPayDate = oPayDatePicker.getDateValue();
            if (!oPayDate) {
                oPayDate = new Date();
                oPayDatePicker.setDateValue(oPayDate);
            }
            mBindingParams.filters.push(new Filter("PaymentDate", FilterOperator.EQ, oPayDate));
        },

        // 公司代码权限校验, 返回false=校验不通过(已弹错误框)
        _checkCompanyAuthority: function () {
            var oSFB = this.byId("SFBBankPayFile");
            if (!oSFB) { return true; }

            var oFilterData = oSFB.getFilterData() || {};
            var oBundle = this.getModel("i18n").getResourceBundle();

            var aAuthorityCompanySet = this.getModel("local").getProperty("/authorityCheck/data/CompanySet");
            if (!aAuthorityCompanySet) {
                return true;
            }

            var aCompanyCodes = [];
            var oCompany = oFilterData.CompanyCode;
            if (typeof oCompany === "string") {
                aCompanyCodes.push(oCompany);
            } else if (oCompany) {
                (oCompany.items || []).forEach(function (item) { aCompanyCodes.push(item.key); });
                (oCompany.ranges || []).forEach(function (range) {
                    if (range.operation === "EQ" && !range.exclude) { aCompanyCodes.push(range.value1); }
                });
                if (oCompany.value) { aCompanyCodes.push(oCompany.value); }
            }

            for (var i = 0; i < aCompanyCodes.length; i++) {
                var sBukrs = aCompanyCodes[i];
                if (sBukrs && !aAuthorityCompanySet.some(function (d) { return d.CompanyCode === sBukrs; })) {
                    MessageBox.error(oBundle.getText("noAuthorityCompanyCode", [sBukrs]));
                    return false;
                }
            }
            return true;
        },

        _removeFilterByPath: function (aFilters, sPath) {
            for (var i = aFilters.length - 1; i >= 0; i--) {
                if (aFilters[i].sPath === sPath) {
                    aFilters.splice(i, 1);
                }
            }
        },

        // 下载: 勾选行按 供应商+币别 汇总, 按所选银行格式导出Excel
        onDownload: function () {
            var oBundle = this.getModel("i18n").getResourceBundle();
            var oTable = this.byId("Table_BankPayFile");

            var aIndices = oTable ? oTable.getSelectedIndices() : [];
            if (aIndices.length === 0) {
                MessageBox.warning(oBundle.getText("selectAtLeastOneRow"));
                return;
            }

            var aRows = [];
            aIndices.forEach(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                var oRow = oContext && oContext.getObject();
                if (oRow) { aRows.push(oRow); }
            });
            if (aRows.length === 0) {
                MessageBox.warning(oBundle.getText("selectAtLeastOneRow"));
                return;
            }

            // 供应商+币别 汇总金额, 其他字段取组内第一行
            var mGroup = {};
            var aGroups = [];
            aRows.forEach(function (oRow) {
                var sKey = oRow.Supplier + "|" + oRow.TransactionCurrency;
                if (!mGroup[sKey]) {
                    mGroup[sKey] = { row: oRow, amount: 0 };
                    aGroups.push(mGroup[sKey]);
                }
                mGroup[sKey].amount += Number(oRow.Amount) || 0;
            });

            var sFormatKey = this.byId("BankFormatSelect").getSelectedKey();
            var oFormat = BANK_FORMATS[sFormatKey];
            if (!oFormat) {
                MessageBox.error(oBundle.getText("bankFormatMissing"));
                return;
            }

            var fnDate = this._formatDate;
            var aData = aGroups.map(function (oGroup, iIndex) {
                return oFormat.buildRow(oGroup.row, Number(oGroup.amount.toFixed(2)), iIndex + 1, fnDate);
            });

            var sFileName = oFormat.name + "付款文件_" + this._formatDate(new Date(), "") + ".xlsx";
            var oSheet = new Spreadsheet({
                workbook: {
                    columns: oFormat.columns,
                    context: { sheetName: oFormat.name }
                },
                dataSource: aData,
                fileName: sFileName
            });
            oSheet.build().finally(function () {
                oSheet.destroy();
            });
        },

        // Date/字符串 → YYYYMMDD 或 YYYY-MM-DD(sep="-")
        _formatDate: function (vValue, sSep) {
            if (!vValue) { return ""; }
            var oDate = vValue instanceof Date ? vValue : new Date(vValue);
            if (isNaN(oDate.getTime())) {
                var s = String(vValue);
                if (/^\d{8}$/.test(s)) {
                    return sSep ? s.substring(0, 4) + sSep + s.substring(4, 6) + sSep + s.substring(6) : s;
                }
                return "";
            }
            var y = String(oDate.getFullYear());
            var m = ("0" + (oDate.getMonth() + 1)).slice(-2);
            var d = ("0" + oDate.getDate()).slice(-2);
            return y + (sSep || "") + m + (sSep || "") + d;
        }
    });
});