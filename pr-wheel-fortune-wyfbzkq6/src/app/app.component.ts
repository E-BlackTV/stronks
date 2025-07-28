import { Component, OnInit } from "@angular/core";
import { DataService } from "./data.service";

@Component({
  selector: "my-app",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent implements OnInit {
  name = "Angular";

  constructor(public dataService: DataService) {}

  ngOnInit(): void {}

  resetWheel() {
    this.dataService.resetToDefault();
  }
}
