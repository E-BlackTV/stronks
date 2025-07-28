import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { FormsModule } from "@angular/forms";

import { AppComponent } from "./app.component";
import { HelloComponent } from "./hello.component";
import { WheelComponent } from "./wheel/wheel.component";
import { OptionsComponent } from "./options/options.component";
import { MatInputModule } from "@angular/material/input";
import { MatIconModule } from "@angular/material/icon";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { MatGridListModule } from "@angular/material/grid-list";
import { ClipboardModule } from "@angular/cdk/clipboard";
import { ClipTextComponent } from "./clip-text/clip-text.component";
import { MatButtonModule } from "@angular/material/button";
import { DataService } from './data.service';

@NgModule({
  imports: [
    BrowserModule,
    FormsModule,
    MatInputModule,
    MatIconModule,
    MatGridListModule,
    BrowserAnimationsModule,
    ClipboardModule,
    MatButtonModule
  ],
  declarations: [
    AppComponent,
    HelloComponent,
    WheelComponent,
    OptionsComponent,
    ClipTextComponent
  ],
  bootstrap: [AppComponent],
  providers: [DataService]
})
export class AppModule {}
