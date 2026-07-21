package com.chainwordgame.app

import android.app.Application
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration

class ChainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Replace this Test Store key with the RevenueCat Google public SDK key before release.
        Purchases.configure(PurchasesConfiguration.Builder(this, "test_EzrijIthPgGccXyOJEnZreoISxW").build())
    }
}
