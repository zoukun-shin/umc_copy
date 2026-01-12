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

			this._UserInfo = sap.ushell.Container.getService("UserInfo");
            this.getRouter().getRoute("RouteMain").attachMatched(this._initialize, this);

        },

		_initialize: function () {
            var sUser = this._UserInfo.getFullName() === undefined ? "" : this._UserInfo.getFullName();
            var sEmail = this._UserInfo.getEmail() === undefined ? "" : this._UserInfo.getEmail();
			// sEmail = "xinlei.xu@sh.shin-china.com";
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
                if (!aAllAccessBtns.some(btn => btn.AccessId === "ecnmanagement-View")) {
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
                        View: aAllAccessBtns.some(btn => btn.AccessId === "ecnmanagement-View"),
                        Create: aAllAccessBtns.some(btn => btn.AccessId === "ecnmanagement-Create"),
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

			// 获取处理范围
			var oValidFromDate = this.byId("idDatePickerValidFromDate");
			if (oValidFromDate.getDateValue()) {
				aNewFilter.push(new Filter("ShippingPlanDate", "BT", formatter.odataDate(oValidFromDate.getDateValue())));
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

			this._LocalData.setProperty("/routeFormMain",true);
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
			let oChangeNumber = this.byId("idChangeNumber");
			let oCompanyCode = this.byId("idCompanyCode");
			let oPlant = this.byId("idPlant");
            let sChangeNumber = oChangeNumber.getValue();
			let sCompanyCode = oCompanyCode.getValue();
			let sPlant = oPlant.getValue();

			this.checkDialogRequired(oChangeNumber);
			this.checkDialogRequired(oCompanyCode);
			this.checkDialogRequired(oPlant);

			this.checkDialogAuth(oChangeNumber);
			this.checkDialogAuth(oCompanyCode);
			this.checkDialogAuth(oPlant);

			let isError = false;
			isError = this.checkDialogFieldError();
			if (isError) {
				return;
			}
			
			let sPath = "/" + this._oDataModel.createKey("EcnManagement",{ChangeNumber:sChangeNumber});
			try {
				await this.readOdataV2(sPath);
				//如果取到值，证明要创建changenumber已经存在，报错
				messages.showError("Change Number already exists.");
			} catch (error) {
				this.getRouter().navTo("Detail",{
					changeNumber:sChangeNumber,
					queryParameter:{
						companyCode:sCompanyCode,
						plant:sPlant
					}
				});
				this._LocalData.setProperty("/routeFormMain",true);
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

		onInnerControlsCreated: function(oEvent) {
            var oInnerInput = oEvent.getParameter("0"); 
            var sPath = "local>/" + oInnerInput.getBinding("value").getPath();
            oInnerInput.bindValue(sPath);
        },

		onDialogChange: function(oEvent) {
			let oControl = oEvent.getSource();
			this.checkDialogRequired(oControl);
			this.checkDialogAuth(oControl);
		},
		checkDialogRequired: function(oControl) {
			if (oControl.getValue()){
				oControl.setValueState("None");
			} else {
				let sLabel = this.byId(oControl.getAriaLabelledBy()[0])?.getText()
				sLabel = sLabel.replace(":","");
				oControl.setValueState("Error");
				oControl.setValueStateText(this._ResourceBundle.getText("msg01",[sLabel]));
			}
		},
		checkDialogAuth: function(oControl) {
			let sValue = oControl.getValue();
			let sPath = oControl.getBindingPath("value");
			let sProperty = "";
			let aRecords = [];
			if (sPath === "Plant"){
				sProperty = "Plant";
				aRecords = this._LocalData.getProperty("/authorityCheck/data/PlantSet");
			}
			if (sPath === "CompanyCode"){
				sProperty = "CompanyCode";
				aRecords = this._LocalData.getProperty("/authorityCheck/data/CompanySet");
			}
			if (sPath === "Plant" || sPath === "CompanyCode"){
				if ( aRecords.findIndex(e => e[sProperty] === sValue) < 0) {
					oControl.setValueState("Error");
					oControl.setValueStateText(this._ResourceBundle.getText("msg09"));
				} else {
					oControl.setValueState("None");
				}
			}
		},
		checkDialogFieldError: function() {
			if ( this.byId("idChangeNumber").getValueState() ===  "Error") {
				return true;
			}
			if ( this.byId("idCompanyCode").getValueState() ===  "Error") {
				return true;
			}
			if ( this.byId("idPlant").getValueState() ===  "Error") {
				return true;
			}
		}
    });
});