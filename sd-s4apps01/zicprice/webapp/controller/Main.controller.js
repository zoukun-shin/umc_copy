sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    // 权限 AccessId（与后台权限配置一致）
    var ACCESS = {
        View:        "zicprice-View",        // 进应用
        ExecPur:     "zicprice-ExecPur",     // 页签1 执行采购价
        ExecSls:     "zicprice-ExecSls",     // 页签1 执行销售价
        UpdateOrder: "zicprice-UpdateOrder"  // 页签2 更新
    };

    // 壳 controller：挂 IconTabBar + 应用级权限校验
    //   业务逻辑在三个子 View 各自的 controller；权限结果放 component 的 "auth" 模型，
    //   子 View 按钮 visible 绑 {auth>/button/...}，工厂校验读 {auth>/data/PlantSet}
    return Controller.extend("sd.zicprice.controller.Main", {

        onInit: function () {
            this._initAuthority();
        },

        _initAuthority: function () {
            var oUserInfo = sap.ushell.Container.getService("UserInfo");
            var sUser  = oUserInfo.getFullName() === undefined ? "" : oUserInfo.getFullName();
            var sEmail = oUserInfo.getEmail() === undefined ? "" : oUserInfo.getEmail();
            var oCtx = this.getOwnerComponent().getModel("Authority").bindContext(
                "/User(Mail='" + sEmail + "',IsActiveEntity=true)", undefined, {
                    "$expand": "_AssignPlant,_AssignRole($expand=_UserRoleAccessBtn)"
                });

            oCtx.requestObject().then(function (oData) {
                var aBtns = [];
                if (oData._AssignRole && oData._AssignRole.length > 0) {
                    oData._AssignRole.forEach(function (role) {
                        aBtns.push(role._UserRoleAccessBtn);
                    });
                    aBtns = aBtns.flat();
                }
                var fnHas = function (sId) {
                    return aBtns.some(function (b) { return b.AccessId === sId; });
                };

                // 无 View 权限 → 销毁视图 + 弹错，整应用不可用
                if (!fnHas(ACCESS.View)) {
                    this._showError(this._text("noAuthorityView", [sUser]));
                    this.getView().destroy();
                    return;
                }

                this.getOwnerComponent().getModel("auth").setData({
                    button: {
                        View:        true,
                        ExecPur:     fnHas(ACCESS.ExecPur),
                        ExecSls:     fnHas(ACCESS.ExecSls),
                        UpdateOrder: fnHas(ACCESS.UpdateOrder)
                    },
                    data: {
                        // [{Plant:'1100'}, ...]
                        PlantSet: oData._AssignPlant || []
                    }
                });
            }.bind(this), function () {
                this._showError(this._text("getAuthorityFailed"));
                this.getView().destroy();
            }.bind(this));
        },

        _showError: function (sText) {
            if (!this._oErrDialog) {
                this._oErrDialog = new sap.m.Dialog({
                    type: sap.m.DialogType.Message,
                    state: "Error",
                    content: new sap.m.Text({ text: sText })
                });
            }
            this._oErrDialog.open();
        },

        _text: function (sKey, aArgs) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        }
    });
});