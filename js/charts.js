
!function ($) {

	var TWCAdvancedChart = {

		chartType: null,
		cachedData: null,
		shownData: null,

		container: null,
		svg: null,
		boxSize: {},
		tooltip: null,

		graphSeries: [],
		numPoints: 0,
		xAxis: null,
		yAxis: [],

		width: null,
		height: null,
		margin: {},

		rangeSelection: [null, null],
		selectionLayer: null,

		chartOptions: {},
		dotStyle: null,

		init: function (options) {

			this.chartType = options.chartType;

			this.cachedData = options.data;
			this.shownDataDeepCopy();

			this.container = d3.select(options.parent[0]).select('svg'); // TODO: pass an svg element
			this.boxSize = options.boxSize || {width: '750px', height: '300px'};
			this.tooltip = options.tooltip || null;
			this.setInitialSize();

			this.width = this.boxSize.width;
			this.height = this.boxSize.height;
			this.margin = {top: 8, right: 16, bottom: 18, left: 8};

			this.rangeSelection = [null, null];
			this.selectionLayer = null;

			this.dotStyle = this.defaultDotStyle();

			this.chartOptions = options.chartOptions;

			this.build();
		},

		setInitialSize: function () {
			// Fix for FF
			this.container.attr("width", this.boxSize.width + "px");
			this.container.attr("height", this.boxSize.height + "px");
		},

		graphMouseMove: function (e) {
			var mouse = d3.mouse(e);
			var xPos = mouse[0] - this.margin.left;
			var xRange = this.width;

			var xBlock = (this.chartType == 'bar')
				? xRange / (this.numPoints)
				: xRange / (this.numPoints - 1);

			if ( xPos > 0 && xPos <= xRange) {
				this.hideTooltip();

				var blockNum = (this.chartType == 'bar')
					? Math.round(xPos / xBlock + 0.5) - 1
					: Math.round(xPos / xBlock);

				this.container.selectAll('.dot').attr("stroke-width", this.dotStyle.stroke).attr('r', this.dotStyle.radius);
				this.container.selectAll('.dot-' + blockNum).attr("stroke-width", this.dotStyle.hlStroke).attr('r', this.dotStyle.hlRadius);

				this.container.selectAll('.yAxis').attr("opacity", 0.1);

				if (this.inRangeSelection()) {
					/* Show election area */
					var x1 = this.rangeSelection[0];
					var x2 = blockNum;
					if (x1 == x2) {
						this.selectionLayer.attr("width", 0); // hides selection layer
					}
					else {
						if (x2 < x1) {
							x2 = x1;
							x1 = blockNum;
						}
						this.selectionLayer
							.attr("width", xBlock * (x2 - x1))
							.attr("transform", "translate(" + (this.margin.left + (xBlock * x1)) + "," + this.margin.top + ")")
					}
				}
				else {
					this.updateTooltip(mouse, blockNum);
				}
			}
		},

		graphMouseOut: function () {
			this.container.selectAll('.dot').attr("stroke-width", this.dotStyle.stroke).attr('r', this.dotStyle.radius);
			this.container.selectAll('.yAxis').attr("opacity", 1);
			if (this.selectionLayer) {
				this.selectionLayer.attr("width", 0); // hides selection layer
			}
			this.hideTooltip();
		},

		graphMouseClick: function (e) {
			var mouse = d3.mouse(e);
			var xPos = mouse[0] - this.margin.left;
			var xRange = this.width;
			var xBlock = xRange / (this.numPoints - 1);
			var idx = Math.round(xPos / xBlock);

			if (this.chartOptions.events.click) {
				if (!this.shownData[0].values[idx]) {
					return;
				}
				this.chartOptions.events.click.cb(this.shownData[0].values[idx]);
			}
			else {
				this.defaultMouseClick(idx);
			}
		},

		defaultMouseClick: function (idx) {
			if (!this.inRangeSelection()) {
				this.rangeSelection[0] = idx;
			}
			else {
				this.rangeSelection[1] = idx;
				this.updateShownData();
			}
		},

		graphNiceLimit: function (num, orient, diff) {
			// num is always positive
			var ref = (diff) ? Math.abs(diff) : num;

			var base = null;
			if (ref < 10) {
				base = 2;
			}
			else if (ref < 100) {
				base = 5;
			}
			else {
				var order = parseInt(Math.log(ref) / Math.LN10) - 1;
				base = Math.pow(10, order);
			}

			var nice = null;
			if (orient == 'top') {
				nice = (num + base) / base;
				nice = Math.floor(nice);
			}
			else { // bottom
				nice = (num - base) / base;
				nice = (nice <= 0) // No negative values in y axis
					? 0
					: Math.ceil(nice);
			}

			return nice * base;
		},

		graphHorizontalLines: function () {
			var style = {'stroke': '#808080', 'strokeWidth': '1px', 'opacity': 0.5}
			this.svg.append("svg:line").attr("x1", 0).attr("y1", 0).attr("x2", this.width).attr("y2", 0)
				.attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")")
				.attr("stroke", style.stroke).attr("stroke-width", style.strokeWidth).attr("opacity", style.opacity);

			var middHeight = Math.round(this.height/2);
			this.svg.append("svg:line").attr("x1", 0).attr("y1", 0).attr("x2", this.width).attr("y2", 0)
				.attr("transform", "translate(" + this.margin.left + "," + (this.margin.top + middHeight) + ")")
				.attr("stroke", style.stroke).attr("stroke-width", style.strokeWidth).attr("opacity", style.opacity);

			this.svg.append("svg:line").attr("x1", 0).attr("y1", 0).attr("x2", this.width).attr("y2", 0)
				.attr("transform", "translate(" + this.margin.left + "," + (this.margin.top + this.height) + ")")
				.attr("stroke", style.stroke).attr("stroke-width", style.strokeWidth).attr("opacity", style.opacity);
		},

		graphBackground: function () {
			this.container.insert("rect", ":first-child")
				.attr("class", "twc-graph-bg")
				.attr("width", this.boxSize.width)
				.attr("height", this.boxSize.height)
				.attr("fill", "#FFFFFF");
		},

		graphRangeSelectionLayer: function () {
			this.selectionLayer = this.svg.append("rect")
				.attr("class", "twc-graph-selection")
				.attr("width", 0)
				.attr("height", this.height)
				.attr("opacity", 0.25)
				.attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")")
				.attr("fill", "#888888");
		},

		graphAxis: function () {
			var that = this;

			// Create X axis
			if (this.xAxis != null) { // TODO: change this!
				var xAxisSvg = this.svg.append("g")
					.attr('font-size', "10px")
					.attr("class", "xAxis")
					.attr("transform", "translate(" + this.margin.left + "," + (this.margin.top + this.height) + ")")
					.call(this.xAxis);
				// hide lines
				xAxisSvg.select('path').attr('opacity', 0);
				xAxisSvg.select('line').attr('opacity', 0);
			}

			// Create Y axis
			$.each(this.yAxis, function (idx, axis) {
				var marginLeft = ( idx == 0 )
					? that.margin.left
					: that.margin.left + that.width;
				var yAxisSvg = that.svg.append("g")
					.attr("class", "yAxis")
					.attr('font-size', "9px")
					.attr("transform", "translate(" + marginLeft + "," + that.margin.top + ")")
					.call(axis);
				// hide lines
				yAxisSvg.select('path').attr('opacity', 0);
				yAxisSvg.select('line').attr('opacity', 0);
			});

			var tickBoxPadding = 6;
			this.svg.selectAll(".yAxis").each(function(){
				var yAxis = d3.select(this);
				yAxis.selectAll(".tick").each(function(){
					var tick = d3.select(this);
					tick.select('text').each(function(){
						var box = this.getBBox();

						tick.insert("rect", ":first-child")
							.attr("class", "tick-bg")
							.attr("x", box.x - (tickBoxPadding/2))
							.attr("y", box.y)
							.attr("rx", 2)
							.attr("ry", 2)
							.attr("width", box.width + tickBoxPadding)
							.attr("height", box.height)
							.attr("fill", "#FFFFFF")
							.attr("opacity", 0.75);
					});
				});
			});
		},

		graphDrawData: function () {
			var that = this;
			// First draw areas

			$.each(this.graphSeries, function (idx, serie) {

				var areaGradient = that.svg.append("svg:defs")
					.append("svg:linearGradient")
					.attr("id", "areaGradient")
					.attr("x1", "0%")
					.attr("y1", "0%")
					.attr("x2", "0%")
					.attr("y2", "100%")
					.attr("spreadMethod", "pad");

				areaGradient.append("svg:stop")
					.attr("offset", "0%")
					.attr("stop-color", serie.color)
					.attr("stop-opacity", .25);
				areaGradient.append("svg:stop")
					.attr("offset", "100%")
					.attr("stop-color", serie.color)
					.attr("stop-opacity", 0);

				that.container.append("svg:path")
					.attr("fill", serie.color)
					.style("fill", "url(#areaGradient)")
					.attr("transform", "translate(" + that.margin.left + "," + that.margin.top + ")")
					.attr("d", serie.area(serie.values));
			});

			var dotStyle = this.dotStyle;
			$.each(this.graphSeries, function (idx, serie) {
				that.svg.append("svg:path")
					.attr("fill", "none")
					.attr("stroke", serie.color)
					.attr("stroke-width", "2px")
					.attr("transform", "translate(" + that.margin.left + "," + that.margin.top + ")")
					.attr("d", serie.line(serie.values));

				that.svg.selectAll("scatter-dots")
					.data(serie.values)
					.enter().append("svg:circle")
					.attr("class", function (d,i) { return 'dot dot-' + i; } )
					.attr("fill", serie.color)
					.attr("stroke", '#FFFFFF')
					.attr("stroke-width", dotStyle.stroke)
					.attr("cx", function (d,i) { return serie.x(d.x); } )
					.attr("cy", function (d) { return serie.y(d.y); } )
					.attr("r", dotStyle.radius)
					.attr("transform", "translate(" + that.margin.left + "," + that.margin.top + ")");
			});

		},

		getTooltipMetrics: function (idx) {
			var that = this;
			var metrics = $('<div>').attr('class', 'metric');
			$.each(this.shownData, function (i, serie) {
				$('<span>').css('color', serie.color).html('&#9679;').appendTo(metrics);
				$('<span>').text(' ' + serie.key).appendTo(metrics);
				metrics.append(' ' + number_format(serie.values[idx].y));

				var metricDiff = null;
				if (typeof serie.values[idx-1] != 'undefined') {
					var diff = serie.values[idx].y - serie.values[idx-1].y;
					var diffClass = 'diff';
					if (diff > 0) {
						diff = '+' + diff;
						diffClass += ' up';
					}
					else if (diff < 0) {
						diffClass += ' down';
					}
					metricDiff = $('<div>').append(' (')
						.append($('<span>').attr('class', diffClass).text(diff))
						.append(')');

					$('<span>').html(metricDiff.html()).appendTo(metrics);
				}
				metrics.append('<br>');

				if ( i == 0 && that.chartOptions.events.click ) {
					metrics.append($('<span>').text(that.chartOptions.events.click.message))
						.append('<br>');
				}
			});
			return metrics;
		},

		hideTooltip: function () {
			this.tooltip.css('display', 'none');
		},

		placeTooltip: function (mouse) {
			var xOffset = 22;
			var top = mouse[1] - 12; // offset: -12
			this.tooltip.css({'display': 'block', 'top': top + 'px'});
			var width = this.boxSize.width;
			if (mouse[0] > (width / 2)) {
				this.tooltip.css('left', '').css('right', ((width - mouse[0]) + xOffset) + 'px');
			}
			else {
				this.tooltip.css('left', (mouse[0] + xOffset) + 'px').css('right', '');
			}
		},

		updateTooltip: function (mouse, idx) {

			if (!this.shownData[0].values[idx]) {
				return;
			}

			var date = moment(this.shownData[0].values[idx].date, 'YYYY-MM-DD');
			var dateStr = {'day': date.format('ddd'), 'date': date.format('MMM D'), 'year': date.format('YYYY')};
			date = $('<div>').attr('class', 'date')
				.text(dateStr.day + ', ' + dateStr.date + ' ')
				.append($('<span>').text(dateStr.year));
			var metrics = this.getTooltipMetrics(idx);

			this.tooltip.empty().append(date).append(metrics);
			this.placeTooltip(mouse);
		},

		getAxisFormat: function () {

			var values = this.shownData[0].values;
			var numPoints = values.length; // at least we have one data serie // TODO: change to this.numPoints

			var timeFormat = '';
			var xTickWidth = 1;
			if (numPoints <= 7) {
				timeFormat = '%a';
				xTickWidth = 24;
			}
			else if (numPoints < 366) {
				timeFormat = '%b %d';
				xTickWidth = 35;
			}
			else {
				timeFormat = '%m/%d/%y';
				xTickWidth = 70;
			}

			var ticksNum = Math.floor(this.boxSize.width / xTickWidth);

			while (ticksNum > 2) {
				var slots = ticksNum - 1;
				if ((numPoints - ticksNum) % slots == 0) {
					break;
				}
				else {
					ticksNum--;
				}
			}

			var xAxisSlots = ticksNum - 1;
			var slotSize = (numPoints - ticksNum) / xAxisSlots;

			var xAxisValues = new Array();
			for ( var idx = 0 ; idx <= xAxisSlots ; idx++ ) {
				xAxisValues.push({
					'idx': (slotSize+1) * idx,
					'val':  new Date(values[ (slotSize+1) * idx ].x)
				});
			}

			return {'text': timeFormat, 'values': xAxisValues, 'totalTicks': numPoints};
		},

		getLineSeriesData: function (bounds) {
			var that = this;

			var xAxis = null;
			var yAxis = new Array();

			var graphSeries = new Array();

			$.each(this.shownData, function (idx, serie) {

				graphSeries[idx] = serie;

				if (bounds) {
					var seriesMin = bounds.seriesMin;
					var seriesMax = bounds.seriesMax;
				}
				else {
					var seriesMin = d3.min(serie.values, function(d) { return d.y; });
					var seriesMax = d3.max(serie.values, function(d) { return d.y; });
				}

				var seriesDiff = seriesMax - seriesMin;

				seriesMin = that.graphNiceLimit(seriesMin, 'bottom', seriesDiff);
				seriesMax = that.graphNiceLimit(seriesMax, 'top', seriesDiff);

				graphSeries[idx].x = d3.scale.linear().range([0, that.width]);
				graphSeries[idx].y = d3.scale.linear().range([that.height, 0]);

				var middle = (seriesMax + seriesMin) / 2;
				var yAxisOrient = (idx == 0) ? 'right' : 'left';
				yAxis[idx] = d3.svg.axis()
					.scale(graphSeries[idx].y)
					.orient(yAxisOrient)
					.tickValues([seriesMin, middle, seriesMax])
					.tickFormat(d3.format('s'));

				graphSeries[idx].line = d3.svg.line()
					.x(function(d, i) {
						return graphSeries[idx].x(d.x); })
					.y(function(d) {
						return graphSeries[idx].y(d.y); });

				graphSeries[idx].area = d3.svg.area()
					.x(function(d) { return graphSeries[idx].x(d.x); })
					.y0(that.height)
					.y1(function(d) { return graphSeries[idx].y(d.y) ; });

				graphSeries[idx].x.domain(d3.extent(serie.values, function(d) { return d.x; }));
				graphSeries[idx].y.domain([seriesMin, seriesMax]);
			});

			var xAxisFormat = this.getAxisFormat();

			xAxis = d3.svg.axis()
				.scale(graphSeries[0].x)
				.orient("bottom")
				.ticks(xAxisFormat.totalTicks)
				.tickValues(xAxisFormat.values.map(function(d) { return d.val; }))
				.tickFormat(d3.time.format(xAxisFormat.text));

			this.graphSeries = graphSeries;
			this.xAxis = xAxis;
			this.yAxis = yAxis;
		},

		buildStackArea: function () {
			var that = this;

			var format = d3.time.format("%Y-%m-%d");

			this.margin = {top: 8, right: 16, bottom: 18, left: 8};
			this.width = this.boxSize.width - this.margin.left - this.margin.right;
			this.height = this.boxSize.height - this.margin.top - this.margin.bottom;

			this.setInitialSize();

			var x = d3.time.scale()
				.range([0, this.width]);

			var y = d3.scale.linear()
				.range([this.height, 0]);

			this.yAxis = d3.svg.axis()
				.scale(y)
				.orient("left");

			var stack = d3.layout.stack()
				.offset("zero")
				.values(function(d) { return d.values; })
				.x(function(d) { return d.date; })
				.y(function(d) { return d.value; });

			var nest = d3.nest()
				.key(function(d) { return d.key; });

			var area = d3.svg.area()
				.interpolate("linear")
				.x(function(d) { return x(d.date) + margin.left; })
				.y0(function(d) {
					return y(d.y0) + margin.top;
				})
				.y1(function(d) {
					return y(d.y0 + d.y) + margin.top;
				});

			this.numPoints = this.shownData[0].values.length; // at least we have one data serie

			this.setDotStyle();

			this.svg = this.container.append("svg:g")
				.attr("width", this.boxSize.width + "px")
				.attr("height", this.boxSize.height + "px");

			var color = [];
			var stackData = new Array();
			$.each(this.shownData, function (idx, serie) {
				color[idx] = serie.color;
				$.each(serie.values, function (idy, val) {
					stackData.push({'date': format.parse(val.date), 'key': serie.key, 'value': val.y});
				});
			});

			var layers = stack(nest.entries(stackData));

			x.domain(d3.extent(stackData, function(d) { return d.date; }));
			var maxY = d3.max(stackData, function(d) { return d.y0 + d.y; });
			y.domain([0, maxY]);

			var xAxisValues = null;
			if (numPoints % 2 == 0) {
				xAxisValues = [new Date(this.shownData[0].values[0].x), new Date(this.shownData[0].values[numPoints-1].x)];
			}
			else {
				xAxisValues = [new Date(this.shownData[0].values[0].x), new Date(this.shownData[0].values[(numPoints-1)/2].x), new Date(this.shownData[0].values[numPoints-1].x)];
			}
			this.xAxis = d3.svg.axis()
				.scale(x)
				.orient("bottom")
				.tickValues(xAxisValues)
				.tickFormat(d3.time.format('%a'));

			var middle = maxY / 2;
			var yAxis = [];
			this.yAxis[0] = d3.svg.axis()
				.scale(y)
				.orient('right')
				.tickValues([0, middle, maxY])
				.tickFormat(d3.format('s'));

			this.svg.selectAll(".layer")
				.data(layers)
				.enter().append("path")
				.attr("class", "layer")
				.attr("d", function(d) { return area(d.values); })
				.style("fill", function(d, i) { return color[i]; });

			this.graphBackground();

			this.graphHorizontalLines();
			this.graphAxis();
			this.graphRangeSelectionLayer();

			var dotStyle = this.dotStyle;
			$.each(layers, function (idxi, layer) {
				$.each(layer.values, function (idxj, dot) {
					if (dot.y > 0) { // Don't show dots with value 0
						that.svg.append("svg:circle")
							.attr("class", 'dot dot-' + idxj)
							.attr("fill", that.shownData[idxi].color)
							.attr("stroke", '#FFFFFF')
							.attr("stroke-width", dotStyle.stroke)
							.attr("cx", x(dot.date))
							.attr("cy", y(dot.y0 + dot.y))
							.attr("r", dotStyle.radius)
							.attr("transform", "translate(" + that.margin.left + "," + that.margin.top + ")");
					}
				});
			});

			this.container.on("mousemove", function() {
				that.graphMouseMove(this);
			}).on("mouseout", function() {
					that.graphMouseOut();
				}).on("click", function (){
					that.graphMouseClick(this);
				});
		},

		buildBarGraph: function () {
			var that = this;

			this.margin = {top: 6, right: 6, bottom: 18, left: 6};
			this.width = this.boxSize.width - this.margin.left - this.margin.right;
			this.height = this.boxSize.height - this.margin.top - this.margin.bottom;

			this.setInitialSize();

			this.numPoints = this.shownData[0].values.length;

			this.svg = this.container.append("svg:g")
				.attr("width", this.boxSize.width + "px")
				.attr("height", this.boxSize.height + "px");

			var x = d3.scale.ordinal()
				.rangeBands([0, this.width],.1,0)
				.domain(this.shownData[0].values.map(function(d) { return d.x; }));

			var y = d3.scale.linear()
				.range([this.height, 0]);

			var yMaxs = new Array();
			var seriesCount = 0;
			$.each(this.shownData, function (idx, serie) {
				yMaxs.push(d3.max(serie.values, function (d) { return d.y }));
				seriesCount++;
			});
			var maxY = d3.max(yMaxs);
			y.domain([0, maxY]);

			var xAxisFormat = this.getAxisFormat();

			var xAxis = this.svg.append("g")
				.attr("class", "xAxis")
				.attr("width", this.width)
				.attr("height", 16)
				.attr("transform", "translate(" + (x.rangeBand()/2 + parseInt(this.margin.left)) + ", " + (parseInt(this.margin.top) + parseInt(this.height) + 16) + ")");

			var format = d3.time.format(xAxisFormat.text);

			var totalPadding = this.width - x.rangeBand() * this.numPoints;
			var barPadding = totalPadding / (this.numPoints-1);

			xAxis.selectAll(".xTicks")
				.data(xAxisFormat.values)
				.enter().append("text")
				.attr("class", "xTick")
				.attr("font-size", "10px")
				.attr("text-anchor", "middle")
				.attr("transform", function (d) { return "translate(" + (d.idx * (that.width/that.numPoints) + parseInt(barPadding) / 2) + ",0)" })
				.text(function (d) { return format(d.val); });

			this.xAxis = null; // xAxis already created

			var barWidth = x.rangeBand() / seriesCount;

			var middle = maxY / 2;
			this.yAxis[0] = d3.svg.axis()
				.scale(y)
				.orient('right')
				.tickValues([0, middle, maxY])
				.tickFormat(d3.format('s'));

			$.each(this.shownData, function (idx, serie) {
				that.svg.selectAll(".bar")
					.data(serie.values)
					.enter().append("rect")
					.attr("class", "bar-" + idx)
					.attr("fill", that.shownData[idx].color)
					.attr("stroke-width", "0")
					.attr("x", function(d) { return x(d.x) + barWidth * idx; })
					.attr("width", barWidth)
					.attr("y", function(d) { return y(d.y); })
					.attr("height", function(d) { return that.height - y(d.y); })
					.attr("transform", "translate(" + that.margin.left + ", " + that.margin.top + ")");
			});

			this.graphBackground();
			this.graphHorizontalLines();
			this.graphAxis();

			this.container.on("mousemove", function() {
				that.graphMouseMove(this);
			})
				.on("mouseout", function() {
					that.graphMouseOut();
				});

		},

		buildLineGraph: function () {
			var that = this;

			this.margin = {top: 15, right: 20, bottom: 20, left: 20};
			this.width = this.boxSize.width - this.margin.left - this.margin.right;
			this.height = this.boxSize.height - this.margin.top - this.margin.bottom;

			this.numPoints = this.shownData[0].values.length; // at least we have one data serie

			this.setInitialSize();
			this.setDotStyle();

			this.svg = this.container.append("svg:g")
				.attr("width", this.boxSize.width + "px")
				.attr("height", this.boxSize.height + "px");

			var bounds = null;
			if (typeof this.chartOptions.dual_axis != 'undefined' && !this.chartOptions.dual_axis) { // if dual_axis is set and set to false
				bounds = {
					seriesMin: d3.min(this.shownData, function(serie) { return d3.min(serie.values, function(d) { return d.y; }); }),
					seriesMax: d3.max(this.shownData, function(serie) { return d3.max(serie.values, function(d) { return d.y; }); })
				};
			}

			var seriesData = this.getLineSeriesData(bounds);

			this.graphHorizontalLines();
			this.graphAxis();
			this.graphDrawData();
			this.graphBackground();
			this.graphRangeSelectionLayer();

			this.container.on("mousemove", function() {
				that.graphMouseMove(this);
			})
				.on("mouseout", function() {
					that.graphMouseOut();
				})
				.on("click", function (){
					that.graphMouseClick(this);
				});
		},

		build: function () {
			switch (this.chartType) {
				case 'stackArea':
					this.buildStackArea();
					break;
				case 'bar':
					this.buildBarGraph();
					break;
				case 'line':
				default:
					this.buildLineGraph();
					break;
			}
		},

		emptyGraph: function () {
			// Remove all children of this.container
			// this.container is a d3 element, not a jQuery element
			var children = this.container.node().childNodes;
			var count = children.length;
			for (var i = count - 1 ; i >= 0 ; i--) {
				// removing children[i] crashes in iPad, selecting the node with d3 and removing it works!!
				d3.select(children[i]).remove();
			}
		},

		emptyAndBuild: function () {
			this.emptyGraph();
			this.build();
		},

		clearRangeSelection: function () {
			this.rangeSelection = [null, null];
			this.selectionLayer
				.attr("width", 0); // Hides selection layer
		},

		inRangeSelection: function () {
			return (this.rangeSelection[0] != null && this.rangeSelection[1] == null);
		},

		updateShownData: function () {
			if (this.rangeSelection[0] != this.rangeSelection[1]) {
				if (this.rangeSelection[0] > this.rangeSelection[1]) {
					this.rangeSelection.reverse();
				}
				var dataLen = this.shownData.length;
				for ( var i = 0 ; i < dataLen ; ++i ) {
					this.shownData[i].values = this.shownData[i].values.slice(this.rangeSelection[0], this.rangeSelection[1] + 1);
				}
				this.emptyAndBuild();
			}
			this.clearRangeSelection();
			return;
		},

		clearSelection: function () {
			this.shownDataDeepCopy();
			this.emptyAndBuild();
		},

		shownDataDeepCopy: function () {
			this.shownData = $.extend(true, [], this.cachedData); // Deep copy by value
		},

		defaultDotStyle: function () {
			return {'radius': 4, 'stroke': '2px', 'hlRadius': 5, 'hlStroke': '0px'};
		},

		setDotStyle: function () {
			var pointSpan = 20;

			switch (this.chartType) {
				case 'stackArea':
					this.dotStyle = {'radius': 0, 'stroke': '0px', 'hlRadius': 3, 'hlStroke': '2px'};
					break;
				default:
					this.dotStyle =  ( this.width / pointSpan > this.numPoints )
						? this.defaultDotStyle()
						: {'radius': 0, 'stroke': '0px', 'hlRadius': 4, 'hlStroke': '2px'};
					break;
			}
		},

	}
}