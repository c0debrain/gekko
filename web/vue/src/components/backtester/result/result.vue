<template lang='jade'>
  div
    .hr.contain
    div.contain
      h3 Backtest result
    result-summary(:report='result.report')
    .hr.contain
    div.contain
      h3 Backtest plot
      a.btn--primary(href='#', id="reset-button", v-on:click.prevent='preventDefault') Reset plot
    chart(:data='result', height='500')
    .hr.contain
    roundtripTable(:roundtrips='result.roundtrips')
</template>

<script>
import resultSummary from './summary.vue'
import chart from './chartWrapper.vue'
import roundtripTable from './roundtripTable.vue'

export default {
  props: ['result'],
  data: () => {
    return {}
  },
  methods: {
    preventDefault:function(){
      return true;
    }
  },
  components: {
    roundtripTable,
    resultSummary,
    chart
  }
}
</script>

<style>
</style>
