sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/core/UIComponent",
    "../model/formatter",
], function (Controller, History, UIComponent, formatter) {
    "use strict";

    return Controller.extend("mm.purorderpricing.controller.BaseController", {

        onInit: function () {
            this.localData = this.getOwnerComponent().getModel("local");
            this.oDataModel = this.getOwnerComponent().getModel();
            this.resourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        getModel: function (sName) {
            return this.getView().getModel(sName);
        },

        setModel: function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getRouter().navTo("RouteMain", {}, true);
            }
        },

        setBusy: function (busy) {
            this.localData.setProperty("/busy", busy, false);
        }
    });
});