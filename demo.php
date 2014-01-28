<!DOCTYPE html>
<html>
    <head>
        <title></title>
    </head>
    <body>

	<div id="chart">
		<svg></svg>
		<div class="tooltip"></div>
	</div>

    </body>
	<script>
		var view = {
			'chartData': <?php echo json_encode($data); ?>
		};
	</script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/d3/3.4.1/d3.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/moment.js/2.5.1/moment.min.js"></script>
    <script src="//code.jquery.com/jquery-2.1.0.min.js"></script>
    <script src="/projects/linechart/js/charts.js"></script>
</html>