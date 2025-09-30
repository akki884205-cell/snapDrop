import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { AnimatedBackgroundComponent } from './login/animated-background.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { PoliciesComponent } from './policies/policies.component';
import { ReportsComponent } from './reports/reports.component';
import { ServiceSensorComponent } from './service-sensor/service-sensor.component';
import { ProfileComponent } from './profile/profile.component';
import { SettingsComponent } from './settings/settings.component';
import { HbarChartComponent } from './components/hbar-chart/hbar-chart.component';
import { WhitelistPanelComponent } from './policies/whitelist-panel/whitelist-panel.component';
import { LineAreaChartComponent } from './components/line-area-chart/line-area-chart.component';
import { PieChartComponent } from './components/pie-chart/pie-chart.component';
import { WorldMapHeatComponent } from './components/world-map-heat/world-map-heat.component';
import { LoadingBarComponent } from './components/loading-bar/loading-bar.component';
import { WhitelistComponent } from './whitelist/whitelist.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    AnimatedBackgroundComponent,
    DashboardComponent,
    PoliciesComponent,
    ReportsComponent,
    ServiceSensorComponent,
    ProfileComponent,
    SettingsComponent,
    HbarChartComponent,
    LineAreaChartComponent,
    PieChartComponent,
    WorldMapHeatComponent,
    LoadingBarComponent,
    WhitelistPanelComponent,
    WhitelistComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
