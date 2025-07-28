import { Component, OnInit } from "@angular/core";
import { DataService } from "../data.service";

@Component({
  selector: "app-clip-text",
  templateUrl: "./clip-text.component.html",
  styleUrls: ["./clip-text.component.css"]
})
export class ClipTextComponent implements OnInit {
  constructor(private dataService: DataService) {}

  value = "";

  ngOnInit() {
    this.dataService.winner$.subscribe(winners => {
      let text = `PRs \n`;

      winners.forEach((winner, i) => (text += `${i + 1}. ${winner}\n`));
      this.value = text;
    });
  }
}
