sap.ui.define([
    "./BaseController",
	"../model/formatter",
	"./messages",
	"sap/ui/core/Fragment",
	"sap/m/Dialog",
	"sap/ui/model/Filter",
], (BaseController, formatter, messages,Fragment, Dialog,Filter) => {
    "use strict";

    return BaseController.extend("pp.ecnmanagement.controller.Main", {
        formatter: formatter,
        onInit() {
			this._LocalData = this.getOwnerComponent().getModel("local");
			this._oDataModel = this.getOwnerComponent().getModel();
			this._ResourceBundle = this.getOwnerComponent().getModel("i18n").getResourceBundle();
			this._BusyDialog = new sap.m.BusyDialog();

        },

		onBeforeRebindTable: function (oEvent) {
			var oFilter = oEvent.getParameter("bindingParams").filters;
			var oNewFilter, aNewFilter = [];

			let aRequested = this.byId("idRequestedMultiComboBox").getSelectedKeys();
			aRequested.forEach(function(key){
				switch(key) {
					case "1":
						aNewFilter.push(new Filter("RequestedByCustomer", "EQ", true)); 
						break;
					case "2":
						aNewFilter.push(new Filter("RequestedByJp", "EQ", true)); 
						break;
					case "3":
						aNewFilter.push(new Filter("RequestedByCn", "EQ", true)); 
						break;
					case "4":
						aNewFilter.push(new Filter("RequestedByHk", "EQ", true)); 
						break;
					case "5":
						aNewFilter.push(new Filter("RequestedByVn", "EQ", true)); 
						break;
					case "6":
						aNewFilter.push(new Filter("RequestedByOther", "EQ", true)); 
						break;
				}
			});
			oNewFilter = new Filter({
				filters:aNewFilter,
				and:false
			});
			if (aNewFilter.length > 0) {
				oFilter.push(oNewFilter);
			}
			aNewFilter = [];

			let aProcess = this.byId("idProcessMultiComboBox").getSelectedKeys();
			aProcess.forEach(function(key){
				switch(key) {
					case "1":
						aNewFilter.push(new Filter("OldNewNotTogether", "EQ", true)); 
						break;
					case "2":
						aNewFilter.push(new Filter("OldStockDelivery", "EQ", true)); 
						break;
					case "3":
						aNewFilter.push(new Filter("ReworkSfg", "EQ", true)); 
						break;
					case "4":
						aNewFilter.push(new Filter("ReworkFg", "EQ", true)); 
						break;
					case "5":
						aNewFilter.push(new Filter("Other", "EQ", true)); 
						break;
				}
			});
			oNewFilter = new Filter({
				filters:aNewFilter,
				and:false
			});
			if (aNewFilter.length > 0) {
				oFilter.push(oNewFilter);
			}
			aNewFilter = [];

			let sDeleteFlagKey = this.byId("idDeleteFlagSelect").getSelectedKey();
			switch (sDeleteFlagKey) {
				case "1":
					aNewFilter.push(new Filter("DeleteFlag", "EQ", true)); break;
				case "2":
					aNewFilter.push(new Filter("DeleteFlag", "EQ", false)); break;
			}

			oNewFilter = new Filter({
				filters:aNewFilter,
				and:true
			});
			if (aNewFilter.length > 0) {
				oFilter.push(oNewFilter);
			}

		},

        onRowActionItemPress: function (oEvent) {
			this._LocalData.setProperty("/detailMode",'change');

			var oItem, oCtx;
			oItem = oEvent.getSource();
			oCtx = oItem.getBindingContext();
			
			this.getRouter().navTo("Detail",{changeNumber:oCtx.getProperty("ChangeNumber")});

			this._oDataModel.resetChanges();
		},

		onCreateButtonPress: function () {		
			this._LocalData.setProperty("/detailMode",'create');	
			if (!this.Dialog) {
				var oView = this.getView();
				if (!this.Dialog) {
					this.Dialog = Fragment.load({
						id: oView.getId(),
						name: "pp.ecnmanagement.fragment.EcnCreateDialog",
						controller: this
					}).then(function (oDialog){
						this.getView().addDependent(oDialog);
						return oDialog;
					}.bind(this));
				}
			}
			this.Dialog.then(function(oDialog) {
				oDialog.open();
			}.bind(this));
		},
		
        onDialogClose: function(){
            this.byId("idEcnCreateDialog").close();
        },

        onDialogConfirm: async function() {
            let sChangeNumber = this.byId("idChangeNumber").getValue();

			let sPath = "/" + this._oDataModel.createKey("EcnManagement",{ChangeNumber:sChangeNumber});
			try {
				await this.readOdataV2(sPath);
				//如果取到值，证明要创建changenumber已经存在，报错
				messages.showError("Change Number already exists.");
			} catch (error) {
				this.getRouter().navTo("Detail",{changeNumber:sChangeNumber});
			}
        },

		readOdataV2: function (sPath) {
			let that = this;
			that._BusyDialog.open();
			return new Promise(function (resolve, reject) {
				var mParameters = {
					success: function (oResponse) {
						that._BusyDialog.close();
						resolve(oResponse);
					},
					error: function (oErr) {
						that._BusyDialog.close();
						reject(oErr);
					}
				};
				that.getOwnerComponent().getModel().read(sPath, mParameters);
			});
		},
    });
});